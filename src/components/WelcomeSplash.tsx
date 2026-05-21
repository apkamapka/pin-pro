/**
 * Ekran powitalny pokazywany przez ~3 s przy starcie apki (przed wyborem
 * profilu). Czysty, jasny layout w duchu marki Mapelo: logo wjeżdża miękko,
 * pod spodem subtelny pasek-akcent w firmowej zieleni/błękicie.
 *
 * Czas trwania kontroluje rodzic (Index) – ten komponent jest czysto
 * prezentacyjny.
 */
export function WelcomeSplash() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 38%, #ffffff 0%, #eef4f1 60%, #e6eef0 100%)",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <style>{`
        @keyframes mapelo-rise {
          0%   { opacity: 0; transform: translateY(14px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes mapelo-glow {
          0%,100% { opacity: 0.45; transform: scale(1); }
          50%     { opacity: 0.75; transform: scale(1.06); }
        }
        @keyframes mapelo-bar {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      {/* miękka poświata za logo (firmowa zieleń) */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          width: "min(78vw, 360px)",
          height: "min(78vw, 360px)",
          borderRadius: "9999px",
          background:
            "radial-gradient(circle, rgba(45,166,140,0.28) 0%, rgba(45,166,140,0) 70%)",
          filter: "blur(6px)",
          animation: "mapelo-glow 3s ease-in-out infinite",
        }}
      />

      <img
        src="/mapelo-mark.png"
        alt="Mapelo"
        className="relative w-[min(64vw,280px)] select-none"
        draggable={false}
        style={{ animation: "mapelo-rise 0.7s cubic-bezier(0.16,1,0.3,1) both" }}
      />

      {/* pasek-akcent (indeterminate) */}
      <div
        className="relative mt-10 h-[3px] w-40 overflow-hidden rounded-full"
        style={{ background: "rgba(20,80,90,0.10)" }}
      >
        <div
          className="absolute inset-y-0 w-2/3 rounded-full"
          style={{
            background: "linear-gradient(90deg, #1f6f8b 0%, #2da68c 100%)",
            animation: "mapelo-bar 1.3s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}
