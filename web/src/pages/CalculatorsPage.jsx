import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CALCULATORS, CALCULATOR_CATEGORIES, findCalculator } from '../data/calculators';
import AdSlot from '../components/AdSlot';
import { EmptyState, Icon } from '../components/ui';

const LEVEL_STYLE = {
  low: 'border-success/40 bg-success-container text-on-success-container',
  medium: 'border-warning/40 bg-warning-container text-on-warning-container',
  high: 'border-error/40 bg-error-container text-on-error-container',
};

/** Hesaplayici listesi — uyelik gerektirmez. */
export function CalculatorsPage() {
  return (
    <div className="mx-auto max-w-container-max-width px-margin-mobile py-10 md:px-margin-desktop">
      <h1 className="text-headline-lg text-on-surface">Klinik Hesaplayıcılar</h1>
      <p className="mt-2 max-w-3xl text-body-md text-secondary">
        Yatak başında en sık kullanılan kardiyoloji ve acil tıp skorları. Üyelik gerekmez; sonuçlar
        anında hesaplanır ve klinik yorumuyla birlikte gösterilir.
      </p>

      {CALCULATOR_CATEGORIES.map((cat) => (
        <section key={cat} className="mt-10">
          <h2 className="text-headline-md text-on-surface">{cat}</h2>
          <div className="mt-4 grid gap-gutter sm:grid-cols-2 lg:grid-cols-3">
            {CALCULATORS.filter((c) => c.category === cat).map((c) => (
              <Link
                key={c.slug}
                to={`/hesaplayicilar/${c.slug}`}
                className="card flex flex-col p-5 transition-shadow hover:shadow-level2"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name={c.icon} size={24} />
                </span>
                <h3 className="mt-3 text-body-lg font-semibold text-on-surface">{c.name}</h3>
                <p className="mt-1 flex-1 text-body-md text-secondary">{c.summary}</p>
                <span className="mt-3 flex items-center gap-1 text-label-sm text-primary">
                  Hesapla <Icon name="arrow_forward" size={16} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <p className="mt-12 rounded-lg border border-outline-variant bg-surface-container-low p-4 text-caption text-secondary">
        <Icon name="info" size={16} /> Bu araçlar karar desteği amaçlıdır; klinik değerlendirmenin
        ve güncel kılavuzların yerini almaz.
      </p>
    </div>
  );
}

/** Tek hesaplayici sayfasi. */
export function CalculatorDetailPage() {
  const { slug } = useParams();
  const calc = findCalculator(slug);
  const [values, setValues] = useState({});

  useEffect(() => {
    // Secim tipi alanlar icin ilk secenegi varsayilan yap
    if (!calc) return;
    const init = {};
    if (calc.type === 'score') {
      for (const f of calc.fields) if (f.options) init[f.id] = 0;
    } else {
      for (const i of calc.inputs) if (i.type === 'select') init[i.id] = i.options[0].value;
    }
    setValues(init);
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const score = useMemo(() => {
    if (!calc || calc.type !== 'score') return 0;
    return calc.fields.reduce((sum, f) => {
      if (f.options) return sum + (Number(values[f.id]) || 0);
      return sum + (values[f.id] ? f.points : 0);
    }, 0);
  }, [calc, values]);

  const formulaResult = useMemo(() => {
    if (!calc || calc.type !== 'formula') return null;
    const ready = calc.inputs.every((i) => values[i.id] !== undefined && values[i.id] !== '');
    if (!ready) return null;
    const nums = Object.fromEntries(calc.inputs.map((i) => [i.id, Number(values[i.id])]));
    if (Object.values(nums).some((n) => Number.isNaN(n) || n <= 0)) return null;
    try {
      return calc.compute(nums);
    } catch {
      return null;
    }
  }, [calc, values]);

  if (!calc)
    return (
      <div className="mx-auto max-w-2xl px-margin-mobile py-16 md:px-margin-desktop">
        <EmptyState
          icon="calculate"
          title="Hesaplayıcı bulunamadı"
          action={
            <Link to="/hesaplayicilar" className="btn-primary mt-2">
              Tüm hesaplayıcılar
            </Link>
          }
        />
      </div>
    );

  const interpretation =
    calc.type === 'score' ? calc.interpret(score, values) : formulaResult?.interpretation;

  const reset = () => {
    const init = {};
    if (calc.type === 'score') {
      for (const f of calc.fields) if (f.options) init[f.id] = 0;
    } else {
      for (const i of calc.inputs) if (i.type === 'select') init[i.id] = i.options[0].value;
    }
    setValues(init);
  };

  return (
    <div className="mx-auto grid max-w-container-max-width gap-gutter px-margin-mobile py-10 md:grid-cols-[1fr_320px] md:px-margin-desktop">
      <div>
        <nav className="mb-3 text-caption text-secondary">
          <Link to="/hesaplayicilar" className="hover:text-primary">
            Hesaplayıcılar
          </Link>
          <span> / {calc.category}</span>
        </nav>

        <h1 className="text-headline-lg text-on-surface">{calc.name}</h1>
        <p className="mt-2 text-body-md text-secondary">{calc.indication}</p>

        <div className="card mt-6 p-6">
          {calc.type === 'score' ? (
            <div className="space-y-3">
              {calc.fields.map((f) =>
                f.options ? (
                  <div key={f.id} className="rounded-lg border border-outline-variant p-4">
                    <div className="mb-2 flex items-center gap-2 text-body-md font-semibold text-on-surface">
                      {f.code && (
                        <span className="chip bg-primary/10 text-primary">{f.code}</span>
                      )}
                      {f.label}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {f.options.map((o) => (
                        <label key={o.label} className="flex cursor-pointer items-center gap-2 text-body-md">
                          <input
                            type="radio"
                            name={f.id}
                            className="border-outline text-primary focus:ring-primary"
                            checked={Number(values[f.id]) === o.points}
                            onChange={() => setValues({ ...values, [f.id]: o.points })}
                          />
                          <span className="flex-1 text-on-surface">{o.label}</span>
                          <span className="text-caption text-secondary">+{o.points}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <label
                    key={f.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${
                      values[f.id]
                        ? 'border-primary bg-primary/5'
                        : 'border-outline-variant hover:bg-surface-container-low'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="rounded border-outline text-primary focus:ring-primary"
                      checked={Boolean(values[f.id])}
                      onChange={(e) => setValues({ ...values, [f.id]: e.target.checked })}
                    />
                    {f.code && <span className="chip bg-primary/10 text-primary">{f.code}</span>}
                    <span className="flex-1 text-body-md text-on-surface">{f.label}</span>
                    <span className="whitespace-nowrap text-caption text-secondary">
                      +{f.points}
                    </span>
                  </label>
                )
              )}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {calc.inputs.map((i) => (
                <div key={i.id}>
                  <label className="label" htmlFor={i.id}>
                    {i.label} {i.unit && <span className="normal-case text-secondary">({i.unit})</span>}
                  </label>
                  {i.type === 'select' ? (
                    <select
                      id={i.id}
                      className="input"
                      value={values[i.id] ?? i.options[0].value}
                      onChange={(e) => setValues({ ...values, [i.id]: Number(e.target.value) })}
                    >
                      {i.options.map((o) => (
                        <option key={o.label} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={i.id}
                      type="number"
                      inputMode="decimal"
                      className="input"
                      min={i.min}
                      max={i.max}
                      step={i.step}
                      value={values[i.id] ?? ''}
                      onChange={(e) => setValues({ ...values, [i.id]: e.target.value })}
                      placeholder="—"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={reset} className="btn-ghost mt-4">
            <Icon name="restart_alt" size={18} /> Sıfırla
          </button>
        </div>

        <AdSlot code="calculator_bottom" className="mt-6" />
      </div>

      {/* Sonuc paneli */}
      <aside className="space-y-4">
        <div className="card p-6 md:sticky md:top-24">
          <div className="text-label-sm uppercase tracking-wider text-secondary">Sonuç</div>

          {calc.type === 'score' ? (
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-display-lg text-primary">{score}</span>
              <span className="text-body-md text-secondary">puan</span>
            </div>
          ) : formulaResult ? (
            <div className="mt-3 space-y-3">
              {formulaResult.results.map((r) => (
                <div key={r.label}>
                  <div className="text-caption text-secondary">{r.label}</div>
                  <div className={r.primary ? 'text-headline-lg text-primary' : 'text-headline-md text-on-surface'}>
                    {r.value} <span className="text-body-md text-secondary">{r.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-body-md text-secondary">
              Hesaplamak için tüm alanları doldurun.
            </p>
          )}

          {interpretation && (
            <div className={`mt-4 rounded-lg border p-4 ${LEVEL_STYLE[interpretation.level]}`}>
              <div className="text-body-md font-semibold">{interpretation.title}</div>
              <p className="mt-1 text-caption">{interpretation.text}</p>
            </div>
          )}

          {calc.note && <p className="mt-3 text-caption text-secondary">{calc.note}</p>}
        </div>

        <AdSlot code="sidebar" />
      </aside>
    </div>
  );
}
