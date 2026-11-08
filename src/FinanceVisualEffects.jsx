import React,{useEffect,useState} from "react";

export function CoinRainEffect({ trigger }) {
  const [coins, setCoins] = useState([]);

  useEffect(() => {
    if (!trigger) return;

    const symbols = ["RM", "$", "€", "¥", "£", "₿"];
    const nextCoins = Array.from({ length: 42 }, (_, index) => ({
      id: `${trigger}-${index}`,
      symbol: symbols[index % symbols.length],
      left: 4 + Math.random() * 92,
      delay: Math.random() * 0.45,
      duration: 4.5 + Math.random() * 0.5,
      size: 24 + Math.random() * 22,
      drift: -90 + Math.random() * 180,
      spin: 720 + Math.random() * 1080,
      wobble: 0.8 + Math.random() * 0.8,
      blur: Math.random() * 0.3,
    }));

    setCoins(nextCoins);

    const timer = setTimeout(() => {
      setCoins([]);
    }, 5500);

    return () => clearTimeout(timer);
  }, [trigger]);

  if (!coins.length) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden">
      <style>
        {`
          @keyframes realisticCoinDrop {
            0% {
              transform: translate3d(0, -14vh, 0) rotateZ(0deg) rotateY(0deg) scale(0.8);
              opacity: 0;
            }
            8% {
              opacity: 1;
            }
            85% {
              opacity: 1;
            }
            100% {
              transform: translate3d(var(--drift), 108vh, 0) rotateZ(var(--spin)) rotateY(1260deg) scale(1.02);
              opacity: 0;
            }
          }

          @keyframes realisticCoinWobble {
            0%, 100% {
              transform: rotateY(0deg) scaleX(1);
            }
            25% {
              transform: rotateY(70deg) scaleX(0.72);
            }
            50% {
              transform: rotateY(0deg) scaleX(1);
            }
            75% {
              transform: rotateY(-70deg) scaleX(0.72);
            }
          }

          @keyframes realisticCoinShine {
            0%, 100% {
              filter: brightness(1) saturate(1);
            }
            50% {
              filter: brightness(1.3) saturate(1.08);
            }
          }

          @keyframes realisticCoinShadow {
            0% {
              opacity: 0;
              transform: translateX(-50%) scale(0.3);
            }
            15% {
              opacity: 0.22;
            }
            100% {
              opacity: 0;
              transform: translateX(calc(-50% + var(--drift) * 0.25)) scale(1.25);
            }
          }
        `}
      </style>

      {coins.map((coin) => (
        <div
          key={coin.id}
          className="absolute top-0"
          style={{
            left: `${coin.left}%`,
            animation: `realisticCoinDrop ${coin.duration}s cubic-bezier(.2,.75,.25,1) ${coin.delay}s forwards`,
            "--drift": `${coin.drift}px`,
            "--spin": `${coin.spin}deg`,
            filter: `blur(${coin.blur}px)`,
          }}
        >
          <div
            className="absolute top-full rounded-full bg-black/30 blur-md"
            style={{
              width: `${coin.size * 0.9}px`,
              height: `${coin.size * 0.22}px`,
              left: "50%",
              marginTop: "10px",
              animation: `realisticCoinShadow ${coin.duration}s linear ${coin.delay}s forwards`,
              transform: "translateX(-50%)",
              "--drift": `${coin.drift}px`,
            }}
          />
          <div
            className="relative flex items-center justify-center rounded-full"
            style={{
              width: `${coin.size}px`,
              height: `${coin.size}px`,
              animation: `realisticCoinWobble ${coin.wobble}s ease-in-out ${coin.delay}s infinite, realisticCoinShine 0.85s ease-in-out ${coin.delay}s infinite`,
              background: "radial-gradient(circle at 30% 28%, #fff4bf 0%, #f7db7c 20%, #d89b1d 45%, #8a5110 78%, #5e3608 100%)",
              border: "1.5px solid rgba(107, 61, 8, 0.9)",
              boxShadow:
                "inset 0 2px 4px rgba(255,255,255,0.62), inset 0 -5px 8px rgba(80,42,5,0.58), 0 8px 18px rgba(0,0,0,0.3)",
            }}
          >
            <div
              className="absolute rounded-full"
              style={{
                inset: "11%",
                border: "1.5px solid rgba(122,72,11,0.7)",
                boxShadow: "inset 0 1px 2px rgba(255,255,255,0.4)",
              }}
            />
            <div
              className="absolute rounded-full"
              style={{
                inset: "21%",
                background: "radial-gradient(circle at 35% 35%, rgba(255,244,191,0.95) 0%, rgba(244,192,67,0.9) 45%, rgba(143,82,16,0.95) 100%)",
                boxShadow: "inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -2px 3px rgba(92,49,6,0.45)",
              }}
            />
            <span
              className="relative z-10 font-black"
              style={{
                fontSize: `${coin.size * 0.32}px`,
                color: "#5c3205",
                textShadow: "0 1px 0 rgba(255,243,191,0.55), 0 -1px 0 rgba(84,46,6,0.35)",
                transform: "translateY(-1px)",
              }}
            >
              {coin.symbol}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
export function IncomeCoinSpinEffect({ trigger }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setVisible(true);

    const timer = setTimeout(() => {
      setVisible(false);
    }, 5200);

    return () => clearTimeout(timer);
  }, [trigger]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden">
      <style>
        {`
          @keyframes incomeCoinBackdrop {
            0% {
              opacity: 0;
            }
            15% {
              opacity: 1;
            }
            85% {
              opacity: 1;
            }
            100% {
              opacity: 0;
            }
          }

          @keyframes incomeCoinEnter {
            0% {
              transform: scale(0.45) rotateZ(-10deg);
              opacity: 0;
            }
            15% {
              transform: scale(1.05) rotateZ(0deg);
              opacity: 1;
            }
            100% {
              transform: scale(1) rotateZ(0deg);
              opacity: 1;
            }
          }

          @keyframes incomeCoinSpin {
            0% {
              transform: rotateY(0deg) rotateZ(0deg);
            }
            100% {
              transform: rotateY(3600deg) rotateZ(10deg);
            }
          }

          @keyframes incomeCoinGlow {
            0%, 100% {
              filter: drop-shadow(0 0 12px rgba(245, 158, 11, 0.4));
            }
            50% {
              filter: drop-shadow(0 0 28px rgba(251, 191, 36, 0.95));
            }
          }

          @keyframes incomeCoinRing {
            0% {
              transform: scale(0.8);
              opacity: 0;
            }
            20% {
              opacity: 0.6;
            }
            100% {
              transform: scale(1.35);
              opacity: 0;
            }
          }
        `}
      </style>

      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,215,120,0.22),rgba(15,23,42,0.68))]"
        style={{ animation: "incomeCoinBackdrop 5s ease forwards" }}
      />
      <div
        className="absolute rounded-full border border-amber-300/60"
        style={{
          width: "240px",
          height: "240px",
          animation: "incomeCoinRing 5s ease-out forwards",
        }}
      />
      <div
        style={{
          animation: "incomeCoinEnter 0.45s ease-out forwards, incomeCoinGlow 0.9s ease-in-out infinite",
          perspective: "1200px",
        }}
      >
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: "220px",
            height: "220px",
            animation: "incomeCoinSpin 5s cubic-bezier(.2,.7,.2,1) forwards",
            background: "radial-gradient(circle at 30% 28%, #fff4bf 0%, #f6d46d 18%, #d28f19 43%, #8a4f10 75%, #5b3106 100%)",
            border: "2px solid rgba(112, 65, 10, 0.95)",
            boxShadow:
              "inset 0 4px 10px rgba(255,255,255,0.58), inset 0 -8px 14px rgba(80,42,5,0.6), 0 18px 45px rgba(0,0,0,0.42)",
          }}
        >
          <div
            className="absolute rounded-full"
            style={{
              inset: "12%",
              border: "2px solid rgba(122,72,11,0.75)",
              boxShadow: "inset 0 2px 3px rgba(255,255,255,0.38)",
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              inset: "24%",
              background: "radial-gradient(circle at 35% 35%, rgba(255,247,200,0.96) 0%, rgba(243,194,72,0.92) 42%, rgba(142,80,16,0.97) 100%)",
              boxShadow: "inset 0 2px 4px rgba(255,255,255,0.35), inset 0 -4px 6px rgba(82,43,5,0.45)",
            }}
          />
          <span
            className="relative z-10 font-black"
            style={{
              fontSize: "62px",
              color: "#5d3406",
              textShadow: "0 2px 0 rgba(255,247,200,0.65), 0 -2px 0 rgba(82,43,5,0.35)",
              transform: "translateY(-2px)",
            }}
          >
            RM
          </span>
        </div>
      </div>
    </div>
  );
}

