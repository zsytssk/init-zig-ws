// ==UserScript==
// @name         youdao fanyi
// @namespace    http://tampermonkey.net/
// @version      2024-08-28
// @description  try to take over the world!
// @author       You
// @match        https://www.youdao.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youdao.com
// @grant        none
// ==/UserScript==

(function () {
  "use strict";
  const url = "http://localhost:60829/ws";
  var ws = new WebSocket(url);

  ws.onopen = function (evt) {
    console.log("ws:> onopen", url);
    ws.send("getInit");
  };
  ws.onclose = function (evt) {
    console.log("ws:> close");
    ws = null;
  };
  ws.onmessage = function (evt) {
    const inputElement = document.getElementById("search_input");
    console.log(`test:>`, evt.data);
    const { type, str } = JSON.parse(evt.data);
    if (type !== "trans") {
      return;
    }
    inputElement.value = str;
    const inputEvent = new Event("input");
    inputElement.dispatchEvent(inputEvent);

    document.querySelector(".translate_btn").click();
  };
  ws.onerror = function (evt) {
    console.log("ws:> error " + evt.data);
  };
})();
