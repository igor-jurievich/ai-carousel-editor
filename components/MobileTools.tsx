"use client";

import { useRef, useState, type MutableRefObject, type TouchEvent } from "react";
import { AppIcon, type AppIconName } from "@/components/icons";
import type { CanvasElement } from "@/types/editor";

export type MobileToolTab = "templates" | "background" | "text";

type MobileToolsProps = {
  activeTab: MobileToolTab | null;
  onTabChange: (tab: MobileToolTab | null) => void;
  selectedElement: CanvasElement | null;
  activeTemplateName: string;
  profileHandle: string;
  profileSubtitle: string;
  hasBackgroundImage: boolean;
  onUploadBackgroundImage: () => void;
  onRemoveBackgroundImage: () => void;
  onOpenTemplateModal: () => void;
  onProfileHandleChange: (value: string) => void;
  onProfileSubtitleChange: (value: string) => void;
  toolbarRef?: MutableRefObject<HTMLElement | null>;
  toolSheetRef?: MutableRefObject<HTMLElement | null>;
  disabled?: boolean;
  previewMode?: boolean;
};

const TOOLBAR_ITEMS: Array<{ id: MobileToolTab; icon: AppIconName; label: string }> = [
  { id: "templates", icon: "templates", label: "Тема" },
  { id: "background", icon: "background", label: "Фото" },
  { id: "text", icon: "text", label: "Подпись" }
];

export function MobileTools({
  activeTab,
  onTabChange,
  selectedElement,
  activeTemplateName,
  profileHandle,
  profileSubtitle,
  hasBackgroundImage,
  onUploadBackgroundImage,
  onRemoveBackgroundImage,
  onOpenTemplateModal,
  onProfileHandleChange,
  onProfileSubtitleChange,
  toolbarRef,
  toolSheetRef,
  disabled = false,
  previewMode = false
}: MobileToolsProps) {
  const swipeRef = useRef<{ startY: number; startX: number; drag: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const selectedElementLabel = selectedElement
    ? selectedElement.type === "text"
      ? "Выбран текстовый элемент"
      : selectedElement.type === "image"
        ? "Выбрано изображение"
        : "Выбрана фигура"
    : "Элемент не выбран";

  const handleSheetTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    swipeRef.current = {
      startY: touch.clientY,
      startX: touch.clientX,
      drag: 0
    };
  };

  const handleSheetTouchMove = (event: TouchEvent<HTMLElement>) => {
    if (!swipeRef.current) {
      return;
    }
    const touch = event.touches[0];
    if (!touch) {
      return;
    }
    const deltaY = touch.clientY - swipeRef.current.startY;
    const deltaX = touch.clientX - swipeRef.current.startX;
    if (deltaY <= 0 || Math.abs(deltaX) > deltaY * 0.9) {
      return;
    }
    swipeRef.current.drag = deltaY;
    setDragOffset(Math.min(180, deltaY));
    event.preventDefault();
  };

  const handleSheetTouchEnd = () => {
    if (!swipeRef.current) {
      return;
    }
    const shouldClose = swipeRef.current.drag > 90;
    swipeRef.current = null;
    setDragOffset(0);
    if (shouldClose) {
      onTabChange(null);
    }
  };

  if (previewMode) {
    return null;
  }

  return (
    <>
      <nav
        ref={(node) => {
          if (toolbarRef) {
            toolbarRef.current = node;
          }
        }}
        className={`mobile-bottom-toolbar ${activeTab ? "is-sheet-open" : ""}`}
        aria-label="Панель инструментов"
      >
        {TOOLBAR_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`mobile-bottom-tool ${isActive ? "active" : ""}`}
              disabled={disabled}
              onClick={() => onTabChange(isActive ? null : item.id)}
            >
              <span className="mobile-bottom-tool-icon">
                <AppIcon name={item.icon} size={16} />
              </span>
              <small>{item.label}</small>
            </button>
          );
        })}
      </nav>

      {activeTab ? (
        <section
          ref={(node) => {
            if (toolSheetRef) {
              toolSheetRef.current = node;
            }
          }}
          className={`mobile-tool-sheet ${dragOffset > 0 ? "is-dragging" : ""}`}
          role="dialog"
          aria-label="Инструменты редактора"
          onTouchStart={handleSheetTouchStart}
          onTouchMove={handleSheetTouchMove}
          onTouchEnd={handleSheetTouchEnd}
          onTouchCancel={handleSheetTouchEnd}
          style={{
            transform: dragOffset ? `translateY(${dragOffset}px)` : undefined
          }}
        >
          <div className="mobile-tool-sheet-handle" />

          <div className="mobile-tool-sheet-header">
            <h3>{getTabTitle(activeTab)}</h3>
            <button
              type="button"
              className="mobile-tool-close"
              onClick={() => onTabChange(null)}
              aria-label="Закрыть панель"
            >
              <AppIcon name="close" size={16} />
            </button>
          </div>

          <div className={`mobile-tool-sheet-body mobile-tool-sheet-body-${activeTab}`}>
            <div className="settings-selected-pill">{selectedElementLabel}</div>

            {activeTab === "templates" ? (
              <div className="settings-block">
                <span className="settings-label">Шаблон карусели</span>
                <button
                  type="button"
                  className="template-library-trigger template-library-trigger-mobile"
                  onClick={() => {
                    onOpenTemplateModal();
                    onTabChange(null);
                  }}
                  disabled={disabled}
                >
                  <span className="template-library-trigger-icon">
                    <AppIcon name="templates" size={16} />
                  </span>
                  <span className="template-library-trigger-copy">
                    <strong>Открыть библиотеку</strong>
                    <small>{activeTemplateName}</small>
                  </span>
                  <AppIcon name="chevron-right" size={14} />
                </button>
              </div>
            ) : null}

            {activeTab === "background" ? (
              <div className="settings-block">
                <span className="settings-label">Фото</span>
                <div className="field-row">
                  <button
                    type="button"
                    className="ghost-chip"
                    onClick={onUploadBackgroundImage}
                    disabled={disabled}
                  >
                    Загрузить
                  </button>
                  <button
                    type="button"
                    className="ghost-chip ghost-chip-muted"
                    onClick={onRemoveBackgroundImage}
                    disabled={!hasBackgroundImage || disabled}
                  >
                    Удалить
                  </button>
                </div>
                <div className="settings-hint">
                  Только ручная загрузка. Автогенерация и поиск изображений отключены.
                </div>
              </div>
            ) : null}

            {activeTab === "text" ? (
              <div className="settings-block">
                <span className="settings-label">Подпись</span>
                <label className="field-label">
                  Ник
                  <input
                    className="field"
                    value={profileHandle}
                    onChange={(event) => onProfileHandleChange(event.target.value)}
                    placeholder="@username"
                    disabled={disabled}
                  />
                </label>
                <label className="field-label">
                  Подпись
                  <input
                    className="field"
                    value={profileSubtitle}
                    onChange={(event) => onProfileSubtitleChange(event.target.value)}
                    placeholder="Надпись"
                    disabled={disabled}
                  />
                </label>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

function getTabTitle(tab: MobileToolTab) {
  if (tab === "templates") {
    return "Тема";
  }

  if (tab === "background") {
    return "Фото";
  }

  return "Подпись";
}
