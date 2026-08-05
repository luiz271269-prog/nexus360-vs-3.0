import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Button } from '@/components/ui/button';
import { Smile, Sticker as StickerIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import StickerPanel from './StickerPanel';

const EMOJI_CATEGORIES = {
  smileys: {
    name: '😊 Sorrisos',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴']
  },
  gestures: {
    name: '👍 Gestos',
    emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏']
  },
  hearts: {
    name: '❤️ Corações',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟']
  },
  animals: {
    name: '🐶 Animais',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦗', '🕷', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿', '🦔']
  },
  food: {
    name: '🍕 Comida',
    emojis: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯']
  },
  activities: {
    name: '⚽ Atividades',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '⛹️', '🤾', '🏌️', '🏇', '🧘', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖', '🎗', '🏵', '🎫', '🎟', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎲', '♟', '🎯', '🎳', '🎮', '🎰', '🧩']
  },
  travel: {
    name: '✈️ Viagens',
    emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩', '💺', '🛰', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥', '🛳', '⛴', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🚏', '🗺', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟', '🎡', '🎢', '🎠', '⛲', '⛱', '🏖', '🏝', '🏜', '🌋', '⛰', '🏔', '🗻', '🏕', '⛺', '🏠', '🏡', '🏘', '🏚', '🏗', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛', '⛪', '🕌', '🕍', '🛕', '🕋', '⛩', '🛤', '🛣', '🗾', '🎑', '🏞', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙', '🌃', '🌌', '🌉', '🌁']
  },
  objects: {
    name: '💡 Objetos',
    emojis: ['⌚', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭', '⏱', '⏲', '⏰', '🕰', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🪔', '🧯', '🛢', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🪛', '🔧', '🔨', '⚒', '🛠', '⛏', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡', '⚔️', '🛡', '🚬', '⚰️', '🪦', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳', '🩹', '🩺', '💊', '💉', '🩸', '🧬', '🦠', '🧫', '🧪', '🌡', '🧹', '🪠', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪥', '🪒', '🧽', '🪣', '🧴', '🛎', '🔑', '🗝', '🚪', '🪑', '🛋', '🛏', '🛌', '🧸', '🪆', '🖼', '🪞', '🪟', '🛍', '🛒', '🎁', '🎈', '🎏', '🎀', '🪄', '🪅', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧']
  },
  symbols: {
    name: '💯 Símbolos',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💯', '💢', '💥', '💫', '💦', '💨', '🕳', '💣', '💬', '👁️‍🗨️', '🗨', '🗯', '💭', '💤', '✨', '⭐', '🌟', '💠', '🔥', '💧', '🌊', '🎵', '🎶', '🔔', '🔕', '📣', '📢', '💬', '💭', '🗯', '♠️', '♥️', '♦️', '♣️', '🃏', '🀄', '🎴', '🔇', '🔈', '🔉', '🔊', '📻', '📱', '📲', '☎️', '📞', '📟', '📠', '🔋', '🔌', '💻', '🖥', '🖨', '⌨️', '🖱', '🖲', '💽', '💾', '💿', '📀', '🧮', '🎥', '🎞', '📽', '🎬', '📺', '📷', '📸', '📹', '📼', '🔍', '🔎', '🕯', '💡', '🔦', '🏮', '🪔', '📔', '📕', '📖', '📗', '📘', '📙', '📚', '📓', '📒', '📃', '📜', '📄', '📰', '🗞', '📑', '🔖', '🏷', '💰', '🪙', '💴', '💵', '💶', '💷', '💸', '💳', '🧾', '💹', '✉️', '📧', '📨', '📩', '📤', '📥', '📦', '📫', '📪', '📬', '📭', '📮', '🗳', '✏️', '✒️', '🖋', '🖊', '🖌', '🖍', '📝', '💼', '📁', '📂', '🗂', '📅', '📆', '🗒', '🗓', '📇', '📈', '📉', '📊', '📋', '📌', '📍', '📎', '🖇', '📏', '📐', '✂️', '🗃', '🗄', '🗑']
  },
  flags: {
    name: '🏁 Bandeiras',
    emojis: ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇧🇷', '🇺🇸', '🇬🇧', '🇫🇷', '🇩🇪', '🇮🇹', '🇪🇸', '🇵🇹', '🇯🇵', '🇨🇳', '🇰🇷', '🇮🇳', '🇷🇺', '🇨🇦', '🇦🇺', '🇲🇽', '🇦🇷', '🇨🇱', '🇨🇴', '🇵🇪', '🇻🇪', '🇺🇾', '🇪🇨', '🇧🇴', '🇵🇾', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮', '🇮🇸', '🇮🇪', '🇳🇱', '🇧🇪', '🇨🇭', '🇦🇹', '🇵🇱', '🇨🇿', '🇸🇰', '🇭🇺', '🇷🇴', '🇧🇬', '🇬🇷', '🇹🇷', '🇮🇱', '🇦🇪', '🇸🇦', '🇪🇬', '🇿🇦', '🇳🇬', '🇰🇪', '🇬🇭', '🇪🇹', '🇹🇿', '🇺🇬', '🇲🇦', '🇩🇿', '🇹🇳', '🇱🇾']
  }
};

export default function EmojiPickerButton({ onEmojiSelect, disabled, usuario, onSendSticker }) {
  const [isOpen, setIsOpen] = useState(false);
  const [modo, setModo] = useState('emoji');
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [pickerPos, setPickerPos] = useState({ bottom: 0, left: 0 });
  const buttonRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (buttonRef.current && !buttonRef.current.contains(event.target)) {
        // Check if click is inside the portal picker
        const picker = document.getElementById('emoji-picker-portal');
        if (picker && picker.contains(event.target)) return;
        setIsOpen(false);
      }
    }

    if (isOpen) {
      // Recalculate position when opening
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPickerPos({
          bottom: window.innerHeight - rect.top + 8,
          left: Math.min(rect.left, window.innerWidth - 320 - 8)
        });
      }
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [isOpen]);

  const handleEmojiClick = (emoji) => {
    onEmojiSelect(emoji);
  };

  const picker = isOpen ? ReactDOM.createPortal(
    <div
      id="emoji-picker-portal"
      style={{
        position: 'fixed',
        bottom: pickerPos.bottom,
        left: pickerPos.left,
        zIndex: 9999,
        width: 320
      }}
      className="bg-white rounded-lg shadow-2xl border border-slate-200"
    >
      {/* Alternador Emoji / Figurinhas */}
      <div className="flex items-center gap-1 p-1.5 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setModo('emoji')}
          className={cn(
            "flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[11px] text-slate-600 hover:bg-slate-100",
            modo === 'emoji' && "bg-slate-200 text-slate-900 font-semibold"
          )}
        >
          <Smile className="w-3.5 h-3.5" /> Emojis
        </button>
        {onSendSticker && (
          <button
            type="button"
            onClick={() => setModo('sticker')}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[11px] text-slate-600 hover:bg-slate-100",
              modo === 'sticker' && "bg-slate-200 text-slate-900 font-semibold"
            )}
          >
            <StickerIcon className="w-3.5 h-3.5" /> Figurinhas
          </button>
        )}
      </div>

      {modo === 'sticker' ? (
        <StickerPanel
          usuario={usuario}
          onSendSticker={onSendSticker}
          onDone={() => setIsOpen(false)}
        />
      ) : (
      <>
      {/* Categorias */}
      <div className="flex items-center gap-1 p-2 border-b border-slate-200 overflow-x-auto">
        {Object.entries(EMOJI_CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveCategory(key)}
            className={cn(
              "px-2 py-1 rounded text-lg hover:bg-slate-100 transition-colors flex-shrink-0",
              activeCategory === key && "bg-slate-200"
            )}
            title={cat.name}
          >
            {cat.emojis[0]}
          </button>
        ))}
      </div>

      {/* Grid de Emojis */}
      <div className="p-2 h-56 overflow-y-auto">
        <div className="grid grid-cols-9 gap-0.5">
          {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleEmojiClick(emoji)}
              className="text-xl hover:bg-slate-100 rounded p-0.5 transition-colors"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-2 py-1 border-t border-slate-200 text-[10px] text-slate-500 text-center">
        {EMOJI_CATEGORIES[activeCategory].name}
      </div>
      </>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <>
      <Button
        ref={buttonRef}
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="h-9 w-9 flex-shrink-0 rounded-full bg-gradient-to-b from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white hover:text-white shadow-lg shadow-orange-500/40 transition-all"
        title="Inserir emoji"
      >
        <Smile className="w-[18px] h-[18px]" />
      </Button>
      {picker}
    </>
  );
}