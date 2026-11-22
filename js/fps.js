/* 帧率检测（fomal 样式 + 本站低性能模式）
   显示结构：<span class="fps-label">FPS</span><span class="fps-value">240</span><span class="fps-state" data-state="good">流畅</span>
   fpson='1' 开启、'0' 关闭；面板里的「帧率监测」调 window.fpsSwitch(on)。 */
(function () {
  var rAF = window.requestAnimationFrame || window.webkitRequestAnimationFrame || function (cb) {
    return window.setTimeout(cb, 1000 / 60);
  };
  var node = null;
  var frame = 0;
  var lastTime = performance.now();
  var warmupUntil = lastTime + 2000; // 首屏解析/解码天然掉帧，前 2 秒不计
  var lowCount = 0;
  var goodCount = 0;
  var lowPerf = false;
  var lastFp = -1;
  var lastState = '';
  var running = false;

  function setLowPerf (on) {
    if (lowPerf === on) return;
    lowPerf = on;
    document.documentElement.classList.toggle('low-perf', on);
  }

  // fomal 的六档：极低/卡顿/偏低/一般/顺畅/流畅
  function stateOf (fps) {
    if (fps <= 5) return ['极低', 'low'];
    if (fps <= 15) return ['卡顿', 'low'];
    if (fps <= 25) return ['偏低', 'warn'];
    if (fps < 35) return ['一般', 'warn'];
    if (fps <= 45) return ['顺畅', 'good'];
    return ['流畅', 'good'];
  }

  function write (fps, status, state) {
    if (!node) node = document.getElementById('fps');
    if (!node) return;
    var key = fps + '|' + state;
    if (key === lastState) return;
    lastState = key;
    node.innerHTML = '<span class="fps-label">FPS</span><span class="fps-value">' + fps +
      '</span><span class="fps-state" data-state="' + state + '">' + status + '</span>';
  }

  function loop (now) {
    if (!running) return;
    now = now || performance.now();
    frame++;
    var elapsed = now - lastTime;
    if (elapsed >= 1000) {
      var fps = Math.round((frame * 1000) / elapsed);
      frame = 0;
      lastTime = now;
      if (now >= warmupUntil) {
        var st = stateOf(fps);
        write(fps, st[0], st[1]);
        if (fps < 35) { lowCount++; goodCount = 0; } else if (fps >= 50) { goodCount++; lowCount = 0; } else { lowCount = 0; goodCount = 0; }
        if (lowCount >= 2) setLowPerf(true);
        if (goodCount >= 5) setLowPerf(false);
      }
    }
    rAF(loop);
  }

  function start () {
    if (running) return;
    running = true;
    frame = 0;
    lastTime = performance.now();
    warmupUntil = lastTime + 1200;
    lastState = '';
    if (node) node.style.display = '';
    rAF(loop);
  }

  function stop () {
    running = false;
    lastState = '';
    setLowPerf(false);
    if (node) {
      node.innerHTML = '';
      node.style.display = 'none';
    }
  }

  window.fpsSwitch = function (on) {
    window.localStorage.setItem('fpson', on ? '1' : '0');
    if (on) start(); else stop();
  };

  document.addEventListener('visibilitychange', function () { if (document.hidden) running = false; else if (window.localStorage.getItem('fpson') !== '0') start(); });

  if (window.localStorage.getItem('fpson') !== '0') start();
})();
