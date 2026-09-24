import "./BadgeAnimation.css";

const BADGES = {
  1: {
    name: "Impression Starter",
    className: "starter",
    symbol: "🥉",
  },

  2: {
    name: "Impression Riser",
    className: "riser",
    symbol: "🥈",
  },

  3: {
    name: "Impression Elite",
    className: "elite",
    symbol: "🥇",
  },

  4: {
    name: "Impression Icon",
    className: "icon",
    symbol: "💎",
  },

  5: {
    name: "Impression Legend",
    className: "legend",
    symbol: "👑",
  },
};

function BadgeAnimation({
  badgeLevel = 1,
  animate = true,
}) {
  const badge = BADGES[badgeLevel] || BADGES[1];

  return (
    <span
      className={`impressa-badge ${badge.className} ${
        animate ? "badge-animate" : ""
      }`}
      title={badge.name}
      aria-label={badge.name}
    >

      {/* BADGE NAME */}

      <span className="badge-name">
        {badge.name}
      </span>


      {/* FIRE / SPARK EFFECT */}

      <span className="badge-fire">

        <span className="fire-core" />

        <span className="fire-flame flame-one" />
        <span className="fire-flame flame-two" />
        <span className="fire-flame flame-three" />

      </span>


      {/* SMALL SPARKS */}

      <span className="badge-sparks">

        <span className="spark spark-one">✦</span>
        <span className="spark spark-two">·</span>
        <span className="spark spark-three">✦</span>
        <span className="spark spark-four">·</span>

      </span>

    </span>
  );
}

export default BadgeAnimation;