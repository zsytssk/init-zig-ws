const std = @import("std");
const httpz = @import("httpz");
const utils = @import("utils.zig");
const websocket = httpz.websocket;
const net = std.net;
const os = std.os;

pub fn main() !void {
    const port = 60829;
    // const port = 9091;

    checkPortAvailable(port) catch |err| {
        std.debug.print("checked port={} error={}\n", .{ port, err });
        return;
    };

    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();
    var app = try App.init(allocator);
    var server = try httpz.Server(*App).init(allocator, .{ .port = port, .request = .{ .max_form_count = 10 } }, &app);

    defer {
        server.stop();
        server.deinit();
        app.deinit();
    }

    var router = server.router(.{});
    router.post("/send", send, .{});
    router.get("/ws", ws, .{});
    try server.listen();
}

fn checkPortAvailable(port: u16) !void {
    const address = try net.Address.parseIp4("127.0.0.1", port);
    var server = try address.listen(.{});
    defer server.deinit();
}

const App = struct {
    allocator: std.mem.Allocator,
    clients: std.SinglyLinkedList(WebsocketHandler),
    tempMsg: utils.MsgStr,
    const Self = @This();
    pub fn init(allocator: std.mem.Allocator) !App {
        const TempMsg = try utils.MsgStr.init(allocator);
        return App{ .tempMsg = TempMsg, .clients = std.SinglyLinkedList(App.WebsocketHandler){}, .allocator = allocator };
    }
    pub fn broadcast(self: *App, msg: []const u8) !void {
        const clients = self.clients;
        var client_op = clients.first;
        while (client_op) |client| {
            try client.data.sendMessage(msg);
            client_op = client.next;
        }
    }
    pub fn deinit(self: *App) void {
        self.tempMsg.deinit();
        var clients = &self.clients;
        var client_op = clients.first;
        while (client_op) |client| {
            client_op = client.next;
            clients.remove(client);
            self.allocator.destroy(client);
        }
    }
    const WebsocketContext = struct { app: *App };

    // See the websocket.zig documentation. But essentially this is your
    // Application's wrapper around 1 websocket connection
    pub const WebsocketHandler = struct {
        conn: *websocket.Conn,
        context: ?WebsocketContext,
        // ctx is arbitrary data you passs to httpz.upgradeWebsocket
        pub fn init(conn: *websocket.Conn, context: WebsocketContext) !WebsocketHandler {
            std.debug.print("WebsocketHandler init\n", .{});
            const handler: WebsocketHandler = WebsocketHandler{
                .conn = conn,
                .context = context,
            };

            const node = try context.app.allocator.create(std.SinglyLinkedList(WebsocketHandler).Node);
            node.data = handler;

            context.app.clients.prepend(node);
            return handler;
        }

        pub fn sendMessage(self: *WebsocketHandler, data: []const u8) !void {
            try self.conn.write(data);
        }

        pub fn clientMessage(self: *WebsocketHandler, data: []const u8) !void {
            if (utils.eql(u8, data, "getInit")) {
                const TempMsg = self.context.?.app.tempMsg;
                try self.conn.write(TempMsg.get());
            } else {
                try self.conn.write(data);
            }
        }

        pub fn close(self: *WebsocketHandler) void {
            // var allocator = self.context.?.app.allocator;
            var clients = &self.context.?.app.clients;
            var client_op = clients.first;
            while (client_op) |client| {
                if (std.meta.eql(client.data, self.*)) {
                    clients.remove(client);
                    self.context = null;
                    break;
                }
                client_op = client.next;
            }
            std.debug.print("client closed:> remain cleints len={}\n", .{clients.len()});
        }
    };
};

// curl -X POST -d "msg=youtube|ddd|ddd|124" "127.0.0.1:9091/send"
fn send(app: *App, req: *httpz.Request, _: *httpz.Response) !void {
    const data = try req.formData();
    const msg = data.get("msg").?;
    try app.tempMsg.set(msg);
    try app.broadcast(msg);
}

fn ws(app: *App, req: *httpz.Request, res: *httpz.Response) !void {
    if (try httpz.upgradeWebsocket(App.WebsocketHandler, req, res, App.WebsocketContext{ .app = app }) == false) {
        res.status = 400;
        res.body = "invalid websocket handshake";
        return;
    }
}
