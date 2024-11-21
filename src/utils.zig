const std = @import("std");

pub const MsgStr = struct {
    allocator: std.mem.Allocator,
    list: []u8,
    len: usize,
    capacity: usize,
    const Self = @This();
    pub fn init(allocator: std.mem.Allocator) !Self {
        const capacity = 100;
        const list = try allocator.alloc(u8, capacity);
        return Self{ .allocator = allocator, .list = list, .len = 0, .capacity = capacity };
    }
    pub fn set(self: *Self, str: []const u8) !void {
        if (self.capacity < str.len) {
            self.allocator.free(self.list);
            const list = try self.allocator.alloc(u8, str.len);
            self.list = list;
            self.capacity = str.len;
        }
        @memcpy(self.list[0..str.len], str[0..str.len]);
        self.len = str.len;
    }

    pub fn get(self: *const Self) []const u8 {
        return self.list[0..self.len];
    }
    pub fn deinit(self: *Self) void {
        self.allocator.free(self.list);
        self.capacity = 0;
        self.len = 0;
    }
};
