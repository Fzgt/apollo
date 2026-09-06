import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxImage {
  src: string;
  alt: string;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_CLICK_SCALE = 2.5;

/**
 * 正文图片的放大层。
 *
 * 没有引灯箱库：现成的那几个都是 20–40 KB，而这里要的就是「铺个遮罩、能缩放平移、
 * 能左右翻」，自己写一百多行反而更省。动画复用项目里已有的 framer-motion。
 *
 * 交互：滚轮以光标为锚点缩放，双击在 1x 和 2.5x 之间切换，放大后可拖拽平移，
 * ←/→ 翻图（翻页时重置缩放），Esc 或点背景关闭。
 * 移动端只做「点开看大图」，双指缩放交给下个版本——自己接管 touch 之后
 * 原生的惯性和边界回弹都要重写，不值得为这一版做。
 */
export function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
  } | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const current = images[index];
  const many = images.length > 1;

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const go = useCallback(
    (step: number) => {
      if (!many) return;
      reset();
      onIndexChange((index + step + images.length) % images.length);
    },
    [index, images.length, many, onIndexChange, reset],
  );

  // 打开期间锁住页面滚动，关掉时还回去（连同原来的 overflow 值）
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // 焦点收进遮罩，关掉时还给点开图片的那个按钮
  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => restoreTo?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return onClose();
      if (event.key === "ArrowRight") return go(1);
      if (event.key === "ArrowLeft") return go(-1);
      if (event.key === "0") return reset();
      if (event.key === "+" || event.key === "=") {
        return setScale((s) => Math.min(MAX_SCALE, s + 0.5));
      }
      if (event.key === "-") {
        setScale((s) => {
          const next = Math.max(MIN_SCALE, s - 0.5);
          if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, reset]);

  // 滚轮缩放要能 preventDefault，React 的 onWheel 是被动监听，只能自己挂
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = surface.getBoundingClientRect();
      // 以光标为锚点：缩放前后，光标下的那个点要停在原地
      const px = event.clientX - rect.left - rect.width / 2;
      const py = event.clientY - rect.top - rect.height / 2;

      setScale((prev) => {
        const next = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, prev * (event.deltaY > 0 ? 0.9 : 1.1)),
        );
        setOffset((current) =>
          next === MIN_SCALE
            ? { x: 0, y: 0 }
            : {
                x: px - ((px - current.x) * next) / prev,
                y: py - ((py - current.y) * next) / prev,
              },
        );
        return next;
      });
    };

    surface.addEventListener("wheel", onWheel, { passive: false });
    return () => surface.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = (event: React.PointerEvent) => {
    if (scale === MIN_SCALE) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({
      x: drag.ox + (event.clientX - drag.x),
      y: drag.oy + (event.clientY - drag.y),
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  if (!current) return null;

  return createPortal(
    <motion.div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={current.alt || "Image"}
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[100] flex flex-col bg-black/85 backdrop-blur-sm outline-none"
    >
      {/* 顶栏：说明文字 + 张数 + 关闭 */}
      <div className="flex shrink-0 items-start justify-between gap-4 px-4 py-3 text-white/70">
        <p className="min-w-0 flex-1 truncate text-sm">{current.alt}</p>
        <div className="flex shrink-0 items-center gap-3">
          {many && (
            <span className="text-xs tabular-nums">
              {index + 1} / {images.length}
            </span>
          )}
          {scale > MIN_SCALE && (
            <span className="text-xs tabular-nums">
              {Math.round(scale * 100)}%
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>

      {/* 点空白处关闭；点图本身不关，否则拖到一半松手就没了 */}
      <div
        ref={surfaceRef}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 pb-4"
      >
        {many && (
          <NavButton side="left" onClick={() => go(-1)}>
            <ChevronLeft className="size-6" />
          </NavButton>
        )}

        <img
          key={current.src}
          src={current.src}
          alt={current.alt}
          draggable={false}
          onDoubleClick={() =>
            scale === MIN_SCALE ? setScale(DOUBLE_CLICK_SCALE) : reset()
          }
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
          className={cn(
            "max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl",
            scale === MIN_SCALE
              ? "cursor-zoom-in"
              : "cursor-grab active:cursor-grabbing",
            !dragRef.current && "transition-transform duration-150",
          )}
        />

        {many && (
          <NavButton side="right" onClick={() => go(1)}>
            <ChevronRight className="size-6" />
          </NavButton>
        )}
      </div>
    </motion.div>,
    document.body,
  );
}

function NavButton({
  side,
  onClick,
  children,
}: {
  side: "left" | "right";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous image" : "Next image"}
      className={cn(
        "absolute top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      {children}
    </button>
  );
}
