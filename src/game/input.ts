/** Keyboard + pointer input, plus "virtual" keys pressed by the on-screen touch controls. */
const virtualDown = new Set<string>();
const virtualPressed = new Set<string>();

export function virtualKey(code: string, down: boolean): void {
  if (down) {
    if (!virtualDown.has(code)) virtualPressed.add(code);
    virtualDown.add(code);
  } else virtualDown.delete(code);
}

export class Input {
  down = new Set<string>();
  pressed = new Set<string>();
  mouseX = 0;
  mouseY = 0;
  clickL = false;
  private handlers: [EventTarget, string, EventListener][] = [];

  constructor(private canvas: HTMLCanvasElement, private viewW: number, private viewH: number) {
    const on = (t: EventTarget, ev: string, fn: EventListener) => {
      t.addEventListener(ev, fn);
      this.handlers.push([t, ev, fn]);
    };
    on(window, 'keydown', ((e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' && e.code === 'Space') return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
    }) as EventListener);
    on(window, 'keyup', ((e: KeyboardEvent) => { this.down.delete(e.code); }) as EventListener);
    on(window, 'blur', () => { this.down.clear(); virtualDown.clear(); });
    on(canvas, 'pointerdown', ((e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * this.viewW;
      this.mouseY = ((e.clientY - r.top) / r.height) * this.viewH;
      this.clickL = true;
    }) as EventListener);
  }

  key(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c) || virtualDown.has(c));
  }

  hit(...codes: string[]): boolean {
    return codes.some((c) => this.pressed.has(c) || virtualPressed.has(c));
  }

  endFrame(): void {
    this.pressed.clear();
    virtualPressed.clear();
    this.clickL = false;
  }

  reset(): void {
    this.down.clear();
    this.pressed.clear();
    virtualDown.clear();
    virtualPressed.clear();
  }

  destroy(): void {
    for (const [t, ev, fn] of this.handlers) t.removeEventListener(ev, fn);
    this.handlers = [];
  }
}
