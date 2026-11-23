export function BoardDecor() {
  return (
    <div className="board-decor" aria-hidden="true">
      <div className="archive-newspaper paper">
        <b>SHAHAR TONGI</b>
        <span>ARXIV NUSXASI</span>
        <h2>Har bir izning o‘z hikoyasi bor</h2>
        <p>
          Vaqt o‘tadi, tafsilotlar qoladi. Guvohning so‘zi, unutilgan maktub va yo‘ldagi iz — har
          biri yangi savolga boshlaydi. Haqiqat tafsilotlarda yashirin.
        </p>
      </div>
      <div className="archive-map paper">
        <span className="tape" />
        <svg viewBox="0 0 240 180">
          <path d="M0 30h240M0 75h240M0 130h240M30 0v180M95 0v180M165 0v180M215 0v180" />
          <path d="M0 165 240 40M0 60l240 100" />
          <circle cx="95" cy="75" r="16" />
          <path className="map-mark" d="M60 130 95 75l70-45" />
        </svg>
        <small>YO‘NALISHLAR QAYDI</small>
      </div>
      <div className="archive-letter paper">
        <span className="tape" />
        <b>TERGOVCHIGA</b>
        <p>
          Dalillarni shoshmasdan o‘rganing. Muhim savol eng kichik tafsilot ortida yashirinishi
          mumkin.
        </p>
        <i>Shaxsiy qaydlar</i>
      </div>
    </div>
  );
}
