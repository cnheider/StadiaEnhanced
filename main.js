// ==UserScript==
// @name        Stadia Enhanced
// @namespace   christopherklay
// @description Various new features for Google Stadia
// @version     0.3
// @author      ChristopherKlay
// @match       https://stadia.google.com/*home
// @grant       none
// ==/UserScript==

// Overlay (Credits to AquaRegia)
// Source: https://www.reddit.com/r/Stadia/comments/eimw7m/tampermonkey_monitor_your_stream/
(function() {
    'use strict';

    function formatBytes(a, b) {
        if (0 == a) return "0 Bytes";
        var c = 1024,
            d = b || 2,
            e = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
            f = Math.floor(Math.log(a) / Math.log(c));
        return parseFloat((a / Math.pow(c, f)).toFixed(d)) + " " + e[f]
    }

    function formatTime(seconds) {
        var hours = Math.floor(seconds / 3600);
        seconds -= hours * 3600;

        var minutes = Math.floor(seconds / 60);
        seconds -= minutes * 60;

        return (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes + ":" + (seconds < 10 ? "0" : "") + Math.floor(seconds);
    }

    var peerConnections = [];
  
    // ==> ISSUE: Injection currently blocking voice chat connection
    (function(original) {
        RTCPeerConnection = function() {
            var connection = new original(arguments);
            peerConnections.push(connection);
            return connection;
        };
        RTCPeerConnection.prototype = original.prototype;
    })(RTCPeerConnection);

    var infoBox = document.createElement("div");
    infoBox.id = "infoBox";
    infoBox.innerHTML = "Stadia Enhanced";
    infoBox.style.position = "fixed";
    infoBox.style.width = "auto";
    infoBox.style.zIndex = 1000;
    infoBox.style.borderRadius = "1rem";
    infoBox.style.background = "linear-gradient(135deg, rgba(255,76,29,0.75) 0%, rgba(155,0,99,0.75) 100%)";
    infoBox.style.padding = "0.5rem";
    infoBox.style.display = "none";
    infoBox.style.fontSize = "0.8rem";
    infoBox.location = 0;
    document.body.appendChild(infoBox);

    var lastTime = new Date();
    var lastBytes = 0;
    var lastFrames = 0;
    var lastFramesDecoded = 0;
    var lastBufferDelay = 0;
    var lastBufferEmitted = 0;
    var lastQpSum = 0;
    var sessionStart;
    var active = false;

    setInterval(function() {
        if (document.location.href.indexOf("/player/") == -1) {
            peerConnections = [];
            lastBytes = 0;
            lastFrames = 0;
            active = false;
            infoBox.innerHTML = "Waiting for game launch.";
        } else if (peerConnections.length % 3 == 0) {
            if (!active) {
                sessionStart = new Date();
                active = true;
            }

            peerConnections[peerConnections.length - 1].getStats().then(function(stats) {
                for (var key of stats.keys()) {
                    if (key.indexOf("RTCInboundRTPVideoStream") != -1) {
                        var tmp1 = stats.get(key);
                        var tmp2 = stats.get(tmp1.trackId);

                        peerConnections[peerConnections.length - 1].getStats(function(stats) {
                            var tmp3 = stats.result().find(function(f) {
                                return "ssrc" == f.type && f.id.endsWith("recv") && f.names().includes("mediaType") && "video" == f.stat("mediaType");
                            });

                            var time = new Date();
                            var timeSinceUpdate = (time - lastTime) / 1000;
                            lastTime = time;
                            var sessionDuration = (time - sessionStart) / 1000;
                            time = new Date(time - time.getTimezoneOffset() * 60 * 1000).toISOString().replace("T", " ").split(".")[0];
                            var resolution = tmp2.frameWidth + "x" + tmp2.frameHeight;
                            var framesReceived = tmp2.framesReceived;
                            var framesReceivedPerSecond = (framesReceived - lastFrames) / timeSinceUpdate;
                            var framesDecoded = tmp2.framesDecoded;
                            var codec = tmp3.stat("googCodecName");
                            var bytesReceived = tmp1.bytesReceived;
                            var bytesReceivedPerSecond = (bytesReceived - lastBytes) / timeSinceUpdate;
                            var averageData = ((((bytesReceived / sessionDuration) * 3600) / 1024) / 1024) / 1024;
                            var packetsLost = tmp1.packetsLost;
                            var packetsReceived = tmp1.packetsReceived;
                            var framesDropped = tmp2.framesDropped;
                            var latency = tmp3.stat("googCurrentDelayMs");
                            var jitterBufferDelay = tmp2.jitterBufferDelay * 1000;
                            var jitterBufferEmittedCount = tmp2.jitterBufferEmittedCount;
                            var jitterBuffer = tmp3.stat("googJitterBufferMs");
                            //var jitterBuffer = parseInt((jitterBufferDelay - lastBufferDelay) / (jitterBufferEmittedCount - lastBufferEmitted));

                            if (codec == "VP9") {
                                var compression = (tmp1.qpSum - lastQpSum) / (framesDecoded - lastFramesDecoded);
                            }

                            lastFrames = framesReceived;
                            lastFramesDecoded = framesDecoded;
                            lastBytes = bytesReceived;
                            lastBufferDelay = jitterBufferDelay;
                            lastBufferEmitted = jitterBufferEmittedCount;
                            lastQpSum = tmp1.qpSum;

                            if (framesReceived > 0) {
                                var html = "";

                                html += '<svg height="40" width="220" viewBox="0 0 120 80" fill="white"><path d="M1.00857143,23.3413856 C0.362857143,23.8032807 0.00285714286,24.5360402 0,25.2901838 L0,25.2901838 L0,25.3201215 C0.00285714286,25.6380308 0.0685714286,25.9602169 0.204285714,26.2667213 L0.204285714,26.2667213 L11.69,52.2882388 C12.1985714,53.441551 13.5114286,54.0060895 14.7014286,53.5841112 L14.7014286,53.5841112 C22.2214286,50.9025535 48.2628571,42.4187946 65.1157143,46.9949777 L65.1157143,46.9949777 C65.1157143,46.9949777 48.21,47.9729409 32.9228571,59.96083 L32.9228571,59.96083 C32.0614286,60.6379911 31.7742857,61.8155385 32.2157143,62.8163113 L32.2157143,62.8163113 C33.4571429,65.6204709 35.9485714,71.2573021 37.3585714,74.4435231 L37.3585714,74.4435231 L39.3385714,79.0881351 C39.81,80.1901256 41.3157143,80.3227066 41.98,79.3247851 L41.98,79.3247851 C45.5471429,73.9531159 51.5614286,71.2701325 57.3385714,68.927868 L57.3385714,68.927868 C63.2571429,66.5300051 69.4328571,64.7408743 75.7328571,63.6759494 L75.7328571,63.6759494 C82.4457143,62.54117 89.3,62.2375168 96.0842857,62.8376953 L96.0842857,62.8376953 C97.2142857,62.9374875 98.2628571,62.2446448 98.6,61.1640383 L98.6,61.1640383 L103.788571,44.5814332 C104.094286,43.6006188 103.742857,42.528566 102.908571,41.9255362 L102.908571,41.9255362 C97.1228571,37.7342657 74.2042857,23.6564437 33.9014286,29.3118077 L33.9014286,29.3118077 C33.9014286,29.3118077 68.2928571,9.55581202 111.954286,31.2577547 L111.954286,31.2577547 C113.277143,31.916383 114.874286,31.2249659 115.315714,29.8193221 L115.315714,29.8193221 L119.89,15.1954944 C119.961429,14.9688237 119.995714,14.7393017 120,14.512631 L120,14.512631 L120,14.4427765 C119.987143,13.6102248 119.541429,12.8204411 118.784286,12.3913349 L118.784286,12.3913349 C113.304286,9.29065 94.7514286,2.79222317e-07 69.23,2.79222317e-07 L69.23,2.79222317e-07 C49.6685714,-0.00142532301 26.0157143,5.45578001 1.00857143,23.3413856"/></svg>'

                                html += "<center><b>" + time + "</b><br/>Session time: " + formatTime(sessionDuration) + "</center>";
                                html += "<br/>";

                                html += "<b>Resolution:</b> " + resolution;
                                html += "<br/>";

                                html += "<b>FPS:</b> " + framesReceivedPerSecond.toFixed(1);
                                html += "<br/>";

                                html += "<b>Codec:</b> " + codec;
                                html += "<br/>";

                                html += "<b>Session traffic:</b> " + formatBytes(bytesReceived, 2);
                                html += "<br/>";

                                html += "<b>Current traffic:</b> " + formatBytes(bytesReceivedPerSecond * 8, 2).slice(0, -1) + "b/s";
                                html += "<br/>";

                                html += "<b>Average traffic:</b> " + averageData.toFixed(2) + " GB/h";
                                html += "<br/>";

                                html += "<b>Packets lost:</b> " + packetsLost + " (" + ((packetsLost / packetsReceived) * 100).toFixed(3) + "%)";
                                html += "<br/>";

                                html += "<b>Frames dropped:</b> " + framesDropped + " (" + ((framesDropped / framesReceived) * 100).toFixed(3) + "%)";
                                html += "<br/>";

                                html += "<b>Latency:</b> " + latency + "ms";
                                html += "<br/>";

                                html += "<b>Jitter buffer:</b> " + jitterBuffer + "ms";
                                html += "<br/>";

                                if (codec == "VP9") {
                                    html += "<b>Compression:</b> " + compression.toFixed(1);
                                    html += "<br/>";
                                }

                                infoBox.innerHTML = html;
                            }
                        });
                    }
                }
            });
        }
    }, 1000);
})();

// Settings - Grid
var gridSize = parseInt(localStorage.getItem("GridSize") || 0);
setGridSize(gridSize)
addGlobalStyle('.z1P2me { width: 90rem; }');
addGlobalStyle('.iadg4b { width: 90rem; }');

var setGrid = document.createElement("div");
setGrid.className = "NfVFqd cr1oJe QAAyWd wJYinb";
setGrid.id = "setGrid";
setGrid.innerHTML = '<svg width="21" height="20"><path fill="#E8EAED" fill-rule="evenodd" d="M18.9 17c0 .56-.52 1-1.1 1h-3.15c-.58 0-1-.44-1-1v-3a1 1 0 011-1h3.15c.58 0 1.1.46 1.1 1v3zm-1.1-6h-3.15a3.04 3.04 0 00-3.1 3v3c0 1.67 1.36 3 3.1 3h3.15c1.74 0 3.2-1.33 3.2-3v-3c0-1.65-1.46-3-3.2-3zM7.35 17c0 .56-.52 1-1.1 1H3.1c-.58 0-1-.44-1-1v-3a1 1 0 011-1h3.15c.58 0 1.1.46 1.1 1v3zm-1.1-6H3.1A3.04 3.04 0 000 14v3c0 1.67 1.36 3 3.1 3h3.15c1.74 0 3.2-1.33 3.2-3v-3c0-1.65-1.46-3-3.2-3zM18.9 6c0 .56-.52 1-1.1 1h-3.15c-.58 0-1-.44-1-1V3a1 1 0 011-1h3.15c.58 0 1.1.46 1.1 1v3zm-1.1-6h-3.15a3.04 3.04 0 00-3.1 3v3c0 1.67 1.36 3 3.1 3h3.15C19.54 9 21 7.67 21 6V3c0-1.65-1.46-3-3.2-3zM7.35 6c0 .56-.52 1-1.1 1H3.1c-.58 0-1-.44-1-1V3a1 1 0 011-1h3.15c.58 0 1.1.46 1.1 1v3zm-1.1-6H3.1A3.04 3.04 0 000 3v3c0 1.67 1.36 3 3.1 3h3.15C8 9 9.45 7.67 9.45 6V3c0-1.65-1.46-3-3.2-3z"/></svg>';
setGrid.style.cursor = "pointer";
setGrid.style.userSelect = "none";
setGrid.addEventListener("click", function() {
  gridSize = (gridSize + 1) % 5;
  localStorage.setItem("GridSize", gridSize);
  setGridSize(gridSize)
});
document.querySelectorAll(".cOj4he")[0].prepend(setGrid);

function setGridSize(size) {
  switch (size) {
    case 0:
      addGlobalStyle('.E3eEyc.H3tvrc { grid-template-columns: repeat(2,auto); }');
      addGlobalStyle('.GqLi4d.qu6XL { width: 44.25rem; height: 26.55rem; }');
      addGlobalStyle('.a1l9D { margin: 0 0 1.5rem 1.5rem; }');
      addGlobalStyle('.E3eEyc { grid-gap: 1.5rem; }');
      break;
    case 1:
      addGlobalStyle('.E3eEyc.H3tvrc { grid-template-columns: repeat(3,auto); }');
      addGlobalStyle('.GqLi4d.qu6XL { width: 29rem; height: 17.4rem; }');
      addGlobalStyle('.a1l9D { margin: 0 0 1.5rem 1.5rem; }');
      addGlobalStyle('.E3eEyc { grid-gap: 1.5rem; }');
      break;
    case 2:
      addGlobalStyle('.E3eEyc.H3tvrc { grid-template-columns: repeat(4,auto); }');
      addGlobalStyle('.GqLi4d.qu6XL { width: 22.125rem; height: 13.2rem; }');
      addGlobalStyle('.a1l9D { margin: 0 0 .5rem .5rem; }');
      addGlobalStyle('.E3eEyc { grid-gap: .5rem; }');
      break;
    case 3:
      addGlobalStyle('.E3eEyc.H3tvrc { grid-template-columns: repeat(5,auto); }');
      addGlobalStyle('.GqLi4d.qu6XL { width: 17.6rem; height: 10.5rem; }');
      addGlobalStyle('.a1l9D { margin: 0 0 .5rem .5rem; }');
      addGlobalStyle('.E3eEyc { grid-gap: .5rem; }');
      break;
    case 4:
      addGlobalStyle('.E3eEyc.H3tvrc { grid-template-columns: repeat(6,auto); }');
      addGlobalStyle('.GqLi4d.qu6XL { width: 14.75rem; height: 8.85em; }');
      addGlobalStyle('.a1l9D { margin: 0 0 .3rem .3rem; }');
      addGlobalStyle('.E3eEyc { grid-gap: .3rem; }');
      break;
  }
  console.log("[Stadia Enhanced] ⚙️ - Library Grid Size: Set to " + (gridSize+2) + ".");
}

// Settings - VP9
var setVP9 = document.createElement("div");
setVP9.className = "bl2XYb soKQKc";
setVP9.id = "setVP9";
if (localStorage.getItem("UseVP9") == "1") {
    setVP9.style.color = "#00e0ba";
    setVP9.innerHTML = "VP9";
    console.log("[Stadia Enhanced] ⚙️ - Codec Preference: VP9");
} else {
    setVP9.style.color = "#ff773d";
    setVP9.innerHTML = "H264";
    console.log("[Stadia Enhanced] ⚙️ - Codec Preference: H264")
}
setVP9.style.cursor = "pointer";
setVP9.style.userSelect = "none";
setVP9.addEventListener("click", function() {
    if (localStorage.getItem("UseVP9") == "1") {
        localStorage.setItem("UseVP9", "0");
        setVP9.style.color = "#ff773d";
        setVP9.innerHTML = "H264";
        console.log("[Stadia Enhanced] ⚙️ - Codec Preference: H264")
    } else {
        localStorage.setItem("UseVP9", "1");
        setVP9.style.color = "#00e0ba";
        setVP9.innerHTML = "VP9";
        console.log("[Stadia Enhanced] ⚙️ - Codec Preference: VP9");
    }
});
document.querySelectorAll(".cOj4he")[0].prepend(setVP9);

// Settings - 4K
var set4K = document.createElement("div");
set4K.className = "bl2XYb soKQKc";
set4K.id = "set4K";
set4K.innerHTML = "4K";
if (localStorage.getItem("Enable4K") == "1") {
    set4K.style.color = "#00e0ba";
    console.log("[Stadia Enhanced] ⚙️ - Resolution: 3840x2160");
} else {
    set4K.style.color = "#ff773d";
    console.log("[Stadia Enhanced] ⚙️ - Resolution: Default");
}
set4K.style.cursor = "pointer";
set4K.style.userSelect = "none";
set4K.addEventListener("click", function() {
    if (localStorage.getItem("Enable4K") == "1") {
        localStorage.setItem("Enable4K", "0");
        set4K.style.color = "#ff773d";
        console.log("[Stadia Enhanced] ⚙️ - Resolution: Default");
    } else {
        localStorage.setItem("Enable4K", "1");
        set4K.style.color = "#00e0ba";
        console.log("[Stadia Enhanced] ⚙️ - Resolution: 3840x2160");
    }
});
document.querySelectorAll(".cOj4he")[0].prepend(set4K);

// Settings - Monitor
var setMon = document.createElement("div");
setMon.className = "CTvDXd QAAyWd Fjy05d ATH3sf wJYinb E6Xpr rpgZzc RkyH1e";
setMon.id = "setMon";
setMon.innerHTML = "Stream Monitor";
setMon.style.cursor = "pointer";
setMon.style.zIndex = "2000";
setMon.style.marginRight = "10px";
setMon.style.userSelect = "none";
setMon.addEventListener("click", function() {
  infoBox.location = (infoBox.location + 1) % 5;
  switch (infoBox.location) {
    case 0:
      infoBox.style.display = "none";
      break;
    case 1:
      infoBox.style.top = "1rem";
      infoBox.style.right = "";
      infoBox.style.bottom = "";
      infoBox.style.left = "1rem";
      infoBox.style.display = "block";
      break;
    case 2:
      infoBox.style.top = "1rem";
      infoBox.style.right = "1rem";
      infoBox.style.bottom = "";
      infoBox.style.left = "";
      infoBox.style.display = "block";
      break;
    case 3:
      infoBox.style.top = "";
      infoBox.style.right = "1rem";
      infoBox.style.bottom = "1rem";
      infoBox.style.left = "";
      infoBox.style.display = "block";
      break;
    case 4:
      infoBox.style.top = "";
      infoBox.style.right = "";
      infoBox.style.bottom = "1rem";
      infoBox.style.left = "1rem";
      infoBox.style.display = "block";
      break;
  }
});


const interval = setInterval(function() {
    // Use VP9 if possible
    if (localStorage.getItem("UseVP9") == "1") {
        localStorage.setItem("video_codec_implementation_by_codec_key", '{"vp9":"ExternalDecoder"}');
    } else {
        localStorage.setItem("video_codec_implementation_by_codec_key", '{"h264":"FFmpeg"}');
    }

    // 4K when supported
    // Source: https://superuser.com/questions/712461/how-to-customize-screen-resolution-reported-to-a-javascript-application-by-a-web
    if (localStorage.getItem("Enable4K") == "1") {
        Object.defineProperty(window.screen, "availWidth", {
            value: 3840
        });
        Object.defineProperty(window.screen, "width", {
            value: 3840
        });
        Object.defineProperty(window.screen, "availHeight", {
            value: 2160
        });
        Object.defineProperty(window.screen, "height", {
            value: 2160
        });
    }
  
    // Re-prepend control after refresh
    var check = document.getElementById("setMon");
    if (check === null) {
      document.querySelectorAll(".VCcUVc")[0].prepend(setMon);
    }
}, 1000);

// Source: https://somethingididnotknow.wordpress.com/2013/07/01/change-page-styles-with-greasemonkeytampermonkey/
function addGlobalStyle(css) {
    var head, style;
    head = document.getElementsByTagName('head')[0];
    if (!head) { return; }
    style = document.createElement('style');
    style.type = 'text/css';
    style.innerHTML = css;
    head.appendChild(style);
}
