var CURSOR;

Math.lerp = (a, b, n) => (1 - n) * a + n * b;

// 为了屏蔽异步加载导致无法读取颜色值，这里统一用哈希表预处理
const map = new Map();
map.set('red', "rgb(241, 71, 71)");
map.set('orange', "rgb(241, 162, 71)");
map.set('yellow', "rgb(241, 238, 71)");
map.set('purple', "rgb(179, 71, 241)");
map.set('blue', "rgb(102, 204, 255)");
map.set('gray', "rgb(226, 226, 226)");
map.set('green', "rgb(57, 197, 187)");
map.set('whitegray', "rgb(241, 241, 241)");
map.set('pink', "rgb(237, 112, 155)");
map.set('black', "rgb(0, 0, 0)");
map.set('darkblue', "rgb(97, 100, 159)");
map.set('heoblue', "rgb(66, 90, 239)");

/* 性能优化（外观与交互完全不变）：
   1. 不再在初始化时遍历全站元素逐个调用 getComputedStyle（原本会强制同步布局上千次）
   2. 不再在每次 mouseover 时序列化 outerHTML 并在大数组里 includes 查找
   3. 鼠标静止 / 标签页隐藏时挂起 rAF，不再每帧空转并写样式
   4. 用 addEventListener 绑定，refresh() 时先解绑，避免重复监听 */
class Cursor {
    constructor() {
        this.pos = {curr: null, prev: null};
        this.pt = [];                       // 保留字段，兼容外部调用
        this.pointerCache = new WeakMap();  // 元素 -> 是否为 pointer
        this.handlers = {};
        this.frameId = 0;
        this.create();
        this.init();
        this.render();
    }

    // 沿用 left/top：#cursor.hover / .active 依赖 transform: scale()，不能用 transform 定位
    move(left, top) {
        this.cursor.style.left = `${left}px`;
        this.cursor.style.top = `${top}px`;
    }

    isPointer(el) {
        if (!el || el.nodeType !== 1) return false;
        let value = this.pointerCache.get(el);
        if (value === undefined) {
            try {
                value = window.getComputedStyle(el).cursor === 'pointer';
            } catch (e) {
                value = false;
            }
            this.pointerCache.set(el, value);
        }
        return value;
    }

    create() {
        if (!this.cursor) {
            this.cursor = document.createElement("div");
            this.cursor.id = "cursor";
            this.cursor.classList.add("hidden");
            document.body.append(this.cursor);
        }

        if (localStorage.getItem("themeColor") == undefined) {
            localStorage.setItem("themeColor", "green");
        }
        const colorVal = map.get(localStorage.getItem("themeColor")) || map.get('green');
        document.body.appendChild((this.scr = document.createElement("style")));
        this.scr.innerHTML = `* {cursor: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' width='8px' height='8px'><circle cx='4' cy='4' r='4' opacity='1.0' fill='` + colorVal + `'/></svg>") 4 4, auto}`;
    }

    detach() {
        Object.keys(this.handlers).forEach(type => {
            document.removeEventListener(type, this.handlers[type]);
        });
        this.handlers = {};
    }

    refresh() {
        this.stop();
        this.detach();
        this.scr.remove();
        this.cursor.classList.remove("hover");
        this.cursor.classList.remove("active");
        this.pos = {curr: null, prev: null};
        this.pt = [];
        this.pointerCache = new WeakMap();

        this.create();
        this.init();
        this.render();
    }

    init() {
        const on = (type, fn) => {
            this.handlers[type] = fn;
            document.addEventListener(type, fn, {passive: true});
        };

        on('mouseover', e => {
            if (this.isPointer(e.target)) this.cursor.classList.add("hover");
        });
        on('mouseout', e => {
            if (this.isPointer(e.target)) this.cursor.classList.remove("hover");
        });
        on('mousemove', e => {
            const x = e.clientX - 8;
            const y = e.clientY - 8;
            if (this.pos.curr == null) this.move(x, y);
            this.pos.curr = {x, y};
            this.cursor.classList.remove("hidden");
            this.wake();
        });
        on('mouseenter', () => this.cursor.classList.remove("hidden"));
        on('mouseleave', () => this.cursor.classList.add("hidden"));
        on('mousedown', () => this.cursor.classList.add("active"));
        on('mouseup', () => this.cursor.classList.remove("active"));

        this.handlers.visibilitychange = () => {
            if (document.hidden) this.stop();
            else this.wake();
        };
        document.addEventListener('visibilitychange', this.handlers.visibilitychange);
    }

    stop() {
        if (this.frameId) cancelAnimationFrame(this.frameId);
        this.frameId = 0;
    }

    wake() {
        if (!this.frameId && !document.hidden && this.pos.curr) {
            this.frameId = requestAnimationFrame(() => this.render());
        }
    }

    render() {
        this.frameId = 0;
        if (document.hidden || !this.pos.curr) return;

        if (this.pos.prev) {
            // 跟踪速度调节，参数与原版一致
            this.pos.prev.x = Math.lerp(this.pos.prev.x, this.pos.curr.x, 0.15);
            this.pos.prev.y = Math.lerp(this.pos.prev.y, this.pos.curr.y, 0.15);
            this.move(this.pos.prev.x, this.pos.prev.y);
        } else {
            this.pos.prev = {x: this.pos.curr.x, y: this.pos.curr.y};
        }

        // 追上目标就挂起，等下一次鼠标移动再唤醒
        const dx = Math.abs(this.pos.prev.x - this.pos.curr.x);
        const dy = Math.abs(this.pos.prev.y - this.pos.curr.y);
        if (dx < 0.1 && dy < 0.1) return;
        this.wake();
    }
}

(() => {
    CURSOR = new Cursor();
    // 需要重新获取列表时，使用 CURSOR.refresh()
})();
