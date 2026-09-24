import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";

function MainLayout({ children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startY = useRef(0);
  const pulling = useRef(false);

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 110;

  useEffect(() => {
    const handleTouchStart = (event) => {
      // Only start pull-to-refresh when already at the top
      if (window.scrollY !== 0) {
        pulling.current = false;
        return;
      }

      startY.current = event.touches[0].clientY;
      pulling.current = true;
    };

    const handleTouchMove = (event) => {
      if (!pulling.current || isRefreshing) {
        return;
      }

      // Only allow pulling downward
      const currentY = event.touches[0].clientY;
      const distance = currentY - startY.current;

      if (distance <= 0) {
        setPullDistance(0);
        return;
      }

      // Prevent the browser's default pull-to-refresh
      event.preventDefault();

      setPullDistance(
        Math.min(distance * 0.55, MAX_PULL)
      );
    };

    const handleTouchEnd = () => {
      if (!pulling.current || isRefreshing) {
        return;
      }

      pulling.current = false;

      if (pullDistance >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        setPullDistance(PULL_THRESHOLD);

        // Small delay so the loading animation is visible
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        setPullDistance(0);
      }
    };

    document.addEventListener(
      "touchstart",
      handleTouchStart,
      { passive: true }
    );

    document.addEventListener(
      "touchmove",
      handleTouchMove,
      { passive: false }
    );

    document.addEventListener(
      "touchend",
      handleTouchEnd,
      { passive: true }
    );

    return () => {
      document.removeEventListener(
        "touchstart",
        handleTouchStart
      );

      document.removeEventListener(
        "touchmove",
        handleTouchMove
      );

      document.removeEventListener(
        "touchend",
        handleTouchEnd
      );
    };
  }, [pullDistance, isRefreshing]);

  const progress = Math.min(
    pullDistance / PULL_THRESHOLD,
    1
  );

  return (
    <>
      <Navbar />

      {/* ==============================
          MOBILE PULL TO REFRESH
      ============================== */}

      <div
        style={{
          position: "fixed",
          top: `${Math.max(
            8,
            pullDistance - 48
          )}px`,
          left: "50%",
          transform: "translateX(-50%)",
          width: "38px",
          height: "38px",
          borderRadius: "50%",
          background: "#ffffff",
          boxShadow:
            "0 2px 10px rgba(0,0,0,0.15)",
          display:
            pullDistance > 5 || isRefreshing
              ? "flex"
              : "none",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "22px",
            height: "22px",
            borderRadius: "50%",
            border: "3px solid #eeeeee",
            borderTopColor: "#ff6a00",
            transform: `rotate(${
              isRefreshing
                ? 360
                : progress * 360
            }deg)`,
            transition: isRefreshing
              ? "transform 0.6s linear"
              : "none",
            animation: isRefreshing
              ? "impressaRefreshSpin 0.7s linear infinite"
              : "none",
          }}
        />
      </div>

      <main>
        {children}
      </main>

      <style>
        {`
          @keyframes impressaRefreshSpin {
            from {
              transform: rotate(0deg);
            }

            to {
              transform: rotate(360deg);
            }
          }

          @media (min-width: 769px) {
            .impressa-pull-refresh {
              display: none;
            }
          }
        `}
      </style>
    </>
  );
}

export default MainLayout;