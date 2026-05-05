const SourceMethod = ({ icon, title, text, status, active, disabled = false, onClick }) => (
    <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`group rounded-lg border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-55 ${active ? 'border-spotify/60 bg-spotify/10' : 'border-white/10 bg-black/30 hover:border-white/20 hover:bg-white/[0.055]'}`}
    >
        <div className="mb-4 flex items-center justify-between">
            <div className="grid h-11 w-11 place-items-center rounded-lg border border-white/10 bg-black/35">
                {icon}
            </div>
            <span className="text-xs font-extrabold uppercase text-white/45">{status}</span>
        </div>
        <h3 className="text-base font-black text-white">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
    </button>
);

export default SourceMethod;
