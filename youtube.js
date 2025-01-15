// ==UserScript==
// @name         youtube jump
// @namespace    http://tampermonkey.net/
// @version      2024-09-16
// @description  try to take over the world!
// @author       You
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        GM_setClipboard
// @run-at       document-end
// ==/UserScript==

function sleep(time) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, time * 1000);
  });
}

function triggerKeyEvent(
  keyCode,
  opts = {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    repeat: false,
  }
) {
  var event = new KeyboardEvent("keydown", {
    keyCode: keyCode,
    which: keyCode,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  document.dispatchEvent(event);
}

let clearFn;
let isOnLoop = false;
function playOne(video, start_time, end_time) {
  let interval;
  let timeout;
  return new Promise((resolve) => {
    video.currentTime = start_time;
    video.play();
    clearFn = () => {
      clearInterval(interval);
      clearTimeout(timeout);
      resolve(false);
    };

    interval = setInterval(() => {
      if (video.currentTime < end_time) {
        return;
      }
      clearInterval(interval);
      video.pause();
      timeout = setTimeout(() => {
        resolve(true);
      }, 500);
    }, 100);
  });
}

function loopVideo(video, start_time, end_time) {
  isOnLoop = true;
  const fn = async () => {
    const ok = await playOne(video, start_time, end_time);
    if (!ok) {
      return;
    }
    fn();
  };
  fn();
}

function clearLoopVideo() {
  isOnLoop = false;
  if (clearFn) {
    clearFn();
  }
}

function togglePause(video) {
  if (isOnLoop) {
    if (video.paused) {
      video.play();
    }
    clearLoopVideo();
    return;
  }
  triggerKeyEvent(75);
}

async function loopVideoList(video, all_time_list) {
  isOnLoop = true;
  let all_time_arr = all_time_list.split(">");
  let [count, cur_index] = all_time_arr[0].split(",").map(Number);
  let time_list = all_time_arr[1];
  const time_arr = time_list.split(";");
  time_arr.pop();
  outerLoop: for (let i = cur_index; i < time_arr.length; i++) {
    const [start_time, end_time] = time_arr[i].split(",");
    for (let num = 0; num < count; num++) {
      const ok = await playOne(video, start_time, end_time);
      if (!ok) {
        break outerLoop;
      }
    }
    await sleep(1);
  }
}

(function () {
  "use strict";
  const url = "http://localhost:60829/ws";
  var ws = new WebSocket(url);

  ws.onopen = function (evt) {
    console.log("ws:> onopen", url);
  };
  ws.onclose = function (evt) {
    console.log("ws:> close");
    ws = null;
  };
  ws.onmessage = function (evt) {
    const [type, action, link, start_time, end_time] = evt.data.split("|");
    console.log(`test:>`, [type, action, link, start_time]);
    if (type !== "youtube" || !location.href.startsWith(link)) {
      return;
    }

    const video = document.querySelector("video");
    switch (action) {
      case "jump":
        clearLoopVideo();
        video.currentTime = start_time;
        video.play();
        break;
      case "loop":
        clearLoopVideo();
        loopVideo(video, start_time, end_time);
        break;
      case "list_loop":
        clearLoopVideo();
        loopVideoList(video, start_time);
        break;
      case "toggle_subtitle":
        triggerKeyEvent("C".charCodeAt(0));
        break;
      case "reduce_speed":
        triggerKeyEvent(188, { shiftKey: true });
        break;
      case "plus_speed":
        triggerKeyEvent(190, { shiftKey: true });
        break;
      case "play_back":
        clearLoopVideo();
        triggerKeyEvent(37);
        break;
      case "play_forward":
        clearLoopVideo();
        triggerKeyEvent(39);
        break;
      case "copy_time":
        GM_setClipboard(video.currentTime.toFixed(1), "text", () =>
          console.log("Clipboard set!")
        );
        break;
      case "toggle_pause":
        togglePause(video);
        break;
    }
  };
  ws.onerror = function (evt) {
    console.log("ws:> error " + evt.data);
  };
})();
