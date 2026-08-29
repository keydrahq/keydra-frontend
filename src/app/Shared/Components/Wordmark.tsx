import type { FC } from 'react';

/**
 * How tall the wordmark is in the masthead.
 *
 * <p>It was 32, which is under PatternFly's own ceiling for the logo slot — {@code
 * --pf-v6-c-masthead__logo--MaxHeight}, 2.375rem — so the mark did not even fill the space the
 * component had already reserved. Raising it to the ceiling was not enough either: this
 * application's masthead is 70 pixels tall, and a 38-pixel mark in it reads as something that was
 * sized for a shorter bar. So the ceiling is raised to match, in {@code app.css} beside this
 * number, and the two have to move together — a wordmark taller than the slot is a wordmark that
 * gets clipped.
 */
const MASTHEAD_HEIGHT = 48;

/**
 * The wordmark, drawn in whatever colour the text around it is.
 *
 * <p>Inline rather than an `<img>` pointing at one of two files, because "which file" turned out
 * to be the wrong question. It was answered from the colour scheme, and the page is drawn dark in
 * more cases than that — the high-contrast theme is dark whatever the scheme says — so the dark
 * ink ended up on a dark masthead, which is the one thing a wordmark must not do.
 *
 * <p>`currentColor` cannot get that wrong: the mark is the same colour as the words beside it, in
 * every theme there is and in whatever theme comes next. The three dots keep Keydra's own red,
 * which is the part that is not the theme's to decide.
 */
export const Wordmark: FC<{ height?: number }> = ({ height = MASTHEAD_HEIGHT }) => (
  <svg
    viewBox="0 0 95.6 32"
    height={height}
    role="img"
    aria-label="Keydra"
    style={{ display: 'block' }}
  >
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="2.0"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="7.5" cy="16.0" r="4.0" />
      <path d="M11.5 16.0 H17.0" />
      <path d="M17.0 16.0 L20.54 12.46 M17.0 16.0 L22.00 16.00 M17.0 16.0 L20.54 19.54" />
    </g>
    <circle cx="7.5" cy="16.0" r="1.1" fill="currentColor" />
    <g fill="#EE0000">
      <circle cx="23.36" cy="9.64" r="2.2" />
      <circle cx="26.00" cy="16.00" r="2.2" />
      <circle cx="23.36" cy="22.36" r="2.2" />
    </g>
    <g fill="currentColor">
      <path
        transform="translate(36.00,22.00) scale(0.017143,-0.017143)"
        d="M67 0V700H192V381L514 700H669L318 364L682 0H514L192 328V0Z"
      />
      <path
        transform="translate(47.30,22.00) scale(0.017143,-0.017143)"
        d="M306 -10Q229 -10 167.5 25.5Q106 61 69.5 121.5Q33 182 33 258Q33 332 68.0 392.5Q103 453 162.0 488.5Q221 524 295 524Q367 524 424.0 488.0Q481 452 514.0 390.0Q547 328 547 250V218H153Q165 163 208.5 127.0Q252 91 312 91Q387 91 433 134L510 62Q464 25 415.0 7.5Q366 -10 306 -10ZM152 305H430Q419 357 381.0 391.0Q343 425 292 425Q239 425 201.5 392.0Q164 359 152 305Z"
      />
      <path
        transform="translate(57.14,22.00) scale(0.017143,-0.017143)"
        d="M99 -215Q63 -215 42 -210V-107Q60 -111 88 -111Q160 -111 190 -38L205 -3L1 515H132L272 143L427 515H555L311 -52Q274 -141 225.0 -178.0Q176 -215 99 -215Z"
      />
      <path
        transform="translate(66.55,22.00) scale(0.017143,-0.017143)"
        d="M294 -7Q221 -7 162.0 28.0Q103 63 68.0 123.5Q33 184 33 258Q33 332 68.0 392.0Q103 452 163.0 487.5Q223 523 297 523Q379 523 444 477V700L563 721V0H446V46Q382 -7 294 -7ZM312 94Q395 94 444 150V366Q421 392 386.0 406.5Q351 421 312 421Q266 421 229.0 400.0Q192 379 170.5 342.0Q149 305 149 259Q149 212 170.5 175.0Q192 138 229.0 116.0Q266 94 312 94Z"
      />
      <path
        transform="translate(77.16,22.00) scale(0.017143,-0.017143)"
        d="M56 0V515H175V453Q199 488 234.5 507.5Q270 527 314 527Q349 526 368 517V412Q338 424 304 424Q216 424 175 339V0Z"
      />
      <path
        transform="translate(83.73,22.00) scale(0.017143,-0.017143)"
        d="M220 -9Q164 -9 121.5 11.0Q79 31 55.0 66.5Q31 102 31 149Q31 222 87.0 263.5Q143 305 241 305Q311 305 374 280V326Q374 426 257 426Q223 426 185.0 415.5Q147 405 99 383L55 471Q171 525 275 525Q378 525 434.0 476.5Q490 428 490 338V0H374V40Q310 -9 220 -9ZM144 151Q144 118 173.0 97.5Q202 77 249 77Q324 77 374 119V199Q322 225 254 225Q203 225 173.5 205.0Q144 185 144 151Z"
      />
    </g>
  </svg>
);

/**
 * The square mark, for the places that want a badge rather than a wordmark.
 *
 * <p>The plate behind it is a surface, so it is drawn with the surface token: on a dark page it
 * is dark, and the ink on it is light, without either being chosen here.
 */
export const Mark: FC<{ size?: number }> = ({ size = 72 }) => (
  <svg
    viewBox="0 0 64 64"
    width={size}
    height={size}
    role="img"
    aria-label="Keydra"
    style={{ display: 'block' }}
  >
    <rect
      x="1"
      y="1"
      width="62"
      height="62"
      rx="13"
      fill="var(--pf-t--global--background--color--primary--default)"
      stroke="var(--pf-t--global--border--color--default)"
      strokeWidth="1"
    />
    <g transform="translate(32,32) scale(1.5) translate(-16.4,-16)">
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2.0"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="7.5" cy="16.0" r="4.0" />
        <path d="M11.5 16.0 H17.0" />
        <path d="M17.0 16.0 L20.54 12.46 M17.0 16.0 L22.00 16.00 M17.0 16.0 L20.54 19.54" />
      </g>
      <circle cx="7.5" cy="16.0" r="1.1" fill="currentColor" />
      <g fill="#EE0000">
        <circle cx="23.36" cy="9.64" r="2.2" />
        <circle cx="26.00" cy="16.00" r="2.2" />
        <circle cx="23.36" cy="22.36" r="2.2" />
      </g>
    </g>
  </svg>
);
