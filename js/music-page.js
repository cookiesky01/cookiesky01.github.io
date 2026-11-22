/**
 * 音乐馆顶部歌单播放器（fomal 同款布局）
 * 歌单来自 Meting 接口，音频直链走网易云外链，和左下角乐高播放器同一套思路。
 */
(function () {
  "use strict";

  var API = "https://api.i-meto.com/meting/api";
  var HOT_API = "https://api.xingzhige.com/API/NetEase_CloudMusic_hotReview/?id=";
  var OUTER_URL = "https://music.163.com/song/media/outer/url?id=";
  var FALLBACK_COVER = "/img/HG.JPG";
  var CACHE_PREFIX = "cookiesky.page-music.v1.";
  var CACHE_TTL = 6 * 60 * 60 * 1000;
  var FETCH_TIMEOUT = 12000;
  var QUOTE_TIMEOUT = 8000;
  var QUOTE_WANT = 8;
  var QUOTE_MAX_CALLS = 8;
  var CONTAINER_ID = "hg-page-player";

  function pickId(item) {
    var id = item.songid || item.id || "";
    if (!id) {
      var matched = String(item.url || "").match(/[?&]id=(\d+)/);
      if (matched) id = matched[1];
    }
    return id ? String(id) : "";
  }

  function toTrack(item) {
    var id = pickId(item);
    if (!id) return null;
    return {
      name: item.title || item.name || "未知歌曲",
      artist: item.author || item.artist || "未知歌手",
      url: OUTER_URL + encodeURIComponent(id) + ".mp3",
      fallback: item.url || "",
      cover: item.pic || item.cover || FALLBACK_COVER,
      type: "auto"
    };
  }

  function normalize(data) {
    if (!Array.isArray(data)) return [];
    return data.map(toTrack).filter(function (track) {
      return track && track.url;
    });
  }

  function readCache(id) {
    try {
      var raw = localStorage.getItem(CACHE_PREFIX + id);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.tracks) || !data.tracks.length) return null;
      return {
        tracks: data.tracks,
        fresh: Date.now() - (data.at || 0) < CACHE_TTL
      };
    } catch (err) {
      return null;
    }
  }

  function saveCache(id, tracks) {
    try {
      localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({
        tracks: tracks,
        at: Date.now()
      }));
    } catch (err) {}
  }

  function fetchPlaylist(id) {
    return new Promise(function (resolve, reject) {
      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (controller) controller.abort();
        reject(new Error("timeout"));
      }, FETCH_TIMEOUT);

      var url = API + "?server=netease&type=playlist&id=" +
        encodeURIComponent(id) + "&r=" + Date.now();

      fetch(url, { cache: "no-store", signal: controller ? controller.signal : undefined })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          clearTimeout(timer);
          var tracks = normalize(data);
          if (!tracks.length) throw new Error("empty playlist");
          resolve(tracks);
        })
        .catch(function (err) {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  function whenAPlayerReady(callback) {
    if (typeof window.APlayer !== "undefined") {
      callback();
      return;
    }
    var tries = 0;
    var timer = setInterval(function () {
      if (typeof window.APlayer !== "undefined") {
        clearInterval(timer);
        callback();
      } else if (++tries > 80) {
        clearInterval(timer);
      }
    }, 250);
  }

  function bindFallback(player) {
    player.on("error", function () {
      var audios = player.list && player.list.audios;
      var track = audios && audios[player.list.index];
      if (!track || !track.fallback || track.__retried) return;
      if (track.url === track.fallback) return;

      track.__retried = true;
      player.audio.src = track.fallback;
      player.audio.load();
      var played = player.audio.play();
      if (played && played.catch) played.catch(function () {});
    });
  }

  function showTip(container) {
    if (container.querySelector(".hg-music-tip")) return;
    var tip = document.createElement("p");
    tip.className = "hg-music-tip";
    tip.textContent = "歌单暂时加载失败，可以点下面的按钮去全屏播放器里听。";
    container.appendChild(tip);
  }

  function build(container, tracks) {
    if (container.dataset.built === "1" || container.querySelector(".aplayer")) return;
    if (typeof window.APlayer === "undefined" || !tracks.length) return;

    var player = new window.APlayer({
      container: container,
      audio: tracks,
      autoplay: false,
      mutex: true,
      preload: "none",
      volume: 0.6,
      listFolded: false,
      listMaxHeight: "340px",
      theme: "#49b1f5",
      storageName: "cookiesky-page-music"
    });

    container.dataset.built = "1";
    window.aplayers = window.aplayers || [];
    window.aplayers.push(player);
    bindFallback(player);

    player.on("play", function () {
      var nav = window.__navMusicPlayer;
      if (nav && nav.audio && !nav.audio.paused) nav.pause();
    });
  }

  function formatLikes(count) {
    var n = Number(count) || 0;
    if (n >= 10000) {
      var w = n / 10000;
      return (w >= 100 ? Math.round(w) : Math.round(w * 10) / 10) + " 万";
    }
    return String(n);
  }

  function fetchOneQuote(playlistId, nonce) {
    return new Promise(function (resolve) {
      var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (controller) controller.abort();
        resolve(null);
      }, QUOTE_TIMEOUT);

      fetch(HOT_API + encodeURIComponent(playlistId) + "&r=" + nonce, {
        cache: "no-store",
        signal: controller ? controller.signal : undefined
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          clearTimeout(timer);
          if (!data || data.code !== 0 || !data.data || !data.data.content) {
            resolve(null);
            return;
          }
          resolve({
            text: String(data.data.content).trim(),
            song: data.data.name || "未知歌曲",
            likes: data.data.likedCount || 0
          });
        })
        .catch(function () {
          clearTimeout(timer);
          resolve(null);
        });
    });
  }

  function renderQuotes(box, quotes) {
    while (box.firstChild) box.removeChild(box.firstChild);
    quotes.forEach(function (quote) {
      var block = document.createElement("blockquote");
      var para = document.createElement("p");
      para.appendChild(document.createTextNode(quote.text));
      var src = document.createElement("span");
      src.className = "hg-quote-src";
      src.textContent = "—— 《" + quote.song + "》热评 · " + formatLikes(quote.likes) + " 赞";
      para.appendChild(src);
      block.appendChild(para);
      box.appendChild(block);
    });
    box.dataset.live = "1";
  }

  function loadHotQuotes(playlistId) {
    var box = document.querySelector("#article-container .hg-music-quotes");
    if (!box || box.dataset.live === "1") return;

    var seen = {};
    var quotes = [];
    var calls = 0;

    function round() {
      var batch = [];
      var size = Math.min(QUOTE_WANT - quotes.length, 4);
      for (var i = 0; i < size && calls < QUOTE_MAX_CALLS; i++) {
        batch.push(fetchOneQuote(playlistId, calls + 1 + "-" + Date.now()));
        calls++;
      }
      Promise.all(batch).then(function (items) {
        items.forEach(function (quote) {
          if (!quote || !quote.text) return;
          var key = quote.text.slice(0, 36);
          if (seen[key]) return;
          seen[key] = 1;
          quotes.push(quote);
        });
        if (calls < QUOTE_MAX_CALLS && quotes.length < QUOTE_WANT) {
          round();
          return;
        }
        if (quotes.length) renderQuotes(box, quotes.slice(0, QUOTE_WANT));
      });
    }

    round();
  }

  function init() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) return;
    var id = container.dataset.playlist;
    if (!id) return;

    loadHotQuotes(id);

    var cached = readCache(id);
    if (cached && cached.fresh) {
      whenAPlayerReady(function () {
        build(container, cached.tracks);
      });
      return;
    }

    whenAPlayerReady(function () {
      fetchPlaylist(id)
        .then(function (tracks) {
          saveCache(id, tracks);
          build(container, tracks);
        })
        .catch(function () {
          if (cached && cached.tracks.length) build(container, cached.tracks);
          else showTip(container);
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, false);
  } else {
    init();
  }

  document.addEventListener("pjax:complete", init, false);
})();