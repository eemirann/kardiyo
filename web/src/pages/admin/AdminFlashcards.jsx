import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { AdminHeader, DataTable, Field, Modal, RowActions, StatusPill, Toggle } from '../../components/admin';
import { ErrorBox, Icon, PageLoader, Spinner } from '../../components/ui';

const PAGE_SIZE = 50;

const emptyDeck = {
  topicId: '',
  title: '',
  slug: '',
  description: '',
  icon: 'style',
  isPremium: false,
  isActive: true,
  sortOrder: 0,
};

const emptyCard = {
  deckId: '',
  front: '',
  back: '',
  hint: '',
  kind: '',
  reference: '',
  sortOrder: 0,
  isActive: true,
};

/** Uzun kart metnini tabloda tek satira sigdirmak icin kisalt. */
function short(text, max = 90) {
  const plain = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > max ? `${plain.slice(0, max)}…` : plain;
}

export default function AdminFlashcards() {
  const toast = useToast();
  const [decks, setDecks] = useState([]);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingDeck, setEditingDeck] = useState(null);
  const [saving, setSaving] = useState(false);

  // Kart listesi (deste filtresi + arama + sayfalama)
  const [deckFilter, setDeckFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [cards, setCards] = useState([]);
  const [cardTotal, setCardTotal] = useState(0);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [editingCard, setEditingCard] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const loadDecks = useCallback(() => {
    setLoading(true);
    api
      .get('/admin/decks')
      .then((d) => {
        setDecks(d.decks);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadCards = useCallback(() => {
    setCardsLoading(true);
    const params = new URLSearchParams({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    if (deckFilter) params.set('deckId', deckFilter);
    if (search.trim()) params.set('search', search.trim());
    api
      .get(`/admin/cards?${params}`)
      .then((d) => {
        setCards(d.cards);
        setCardTotal(d.total);
      })
      .catch((e) => toast.error('Kartlar yüklenemedi', e.message))
      .finally(() => setCardsLoading(false));
    // toast referansi her renderda degisebiliyor; bagimliliga almiyoruz
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckFilter, search, page]);

  useEffect(() => {
    loadDecks();
    api.get('/admin/topics').then((d) => setTopics(d.topics)).catch(() => {});
  }, [loadDecks]);

  // Arama yazarken her tusa istek atmamak icin kisa gecikme
  useEffect(() => {
    const t = setTimeout(loadCards, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [loadCards, search]);

  const setDeckForm = (patch) =>
    setEditingDeck((prev) => ({ ...prev, form: { ...prev.form, ...patch } }));
  const setCardForm = (patch) =>
    setEditingCard((prev) => ({ ...prev, form: { ...prev.form, ...patch } }));

  const saveDeck = async (e) => {
    e.preventDefault();
    const f = editingDeck.form;
    setSaving(true);
    try {
      const payload = {
        ...f,
        topicId: f.topicId ? Number(f.topicId) : null,
        slug: f.slug || undefined,
        description: f.description || null,
        sortOrder: Number(f.sortOrder) || 0,
      };
      if (editingDeck.id) await api.put(`/admin/decks/${editingDeck.id}`, payload);
      else await api.post('/admin/decks', payload);
      toast.success(editingDeck.id ? 'Deste güncellendi' : 'Deste eklendi');
      setEditingDeck(null);
      loadDecks();
    } catch (err) {
      toast.error('Kaydedilemedi', err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeDeck = async (d) => {
    if (
      !window.confirm(
        `"${d.title}" destesi ve içindeki ${d.card_count} kart silinsin mi? Bu işlem geri alınamaz.`
      )
    )
      return;
    try {
      await api.del(`/admin/decks/${d.id}`);
      toast.success('Deste silindi');
      loadDecks();
      loadCards();
    } catch (err) {
      toast.error('Silinemedi', err.message);
    }
  };

  const saveCard = async (e) => {
    e.preventDefault();
    const f = editingCard.form;
    if (!f.deckId) {
      toast.error('Deste seçin');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...f,
        deckId: Number(f.deckId),
        hint: f.hint || null,
        kind: f.kind || null,
        reference: f.reference || null,
        sortOrder: Number(f.sortOrder) || 0,
      };
      if (editingCard.id) await api.put(`/admin/cards/${editingCard.id}`, payload);
      else await api.post('/admin/cards', payload);
      toast.success(editingCard.id ? 'Kart güncellendi' : 'Kart eklendi');
      setEditingCard(null);
      loadCards();
      loadDecks();
    } catch (err) {
      toast.error('Kaydedilemedi', err.message);
    } finally {
      setSaving(false);
    }
  };

  const removeCard = async (c) => {
    if (!window.confirm('Bu kart silinsin mi?')) return;
    try {
      await api.del(`/admin/cards/${c.id}`);
      toast.success('Kart silindi');
      loadCards();
      loadDecks();
    } catch (err) {
      toast.error('Silinemedi', err.message);
    }
  };

  const lastPage = Math.max(0, Math.ceil(cardTotal / PAGE_SIZE) - 1);

  return (
    <div>
      <AdminHeader
        title="Flashcard"
        description="Desteleri ve kartları yönetin. Kartlar aralıklı tekrar algoritmasıyla üyelere dağıtılır."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline" onClick={() => setBulkOpen(true)}>
              <Icon name="upload_file" size={18} /> Toplu kart ekle
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setEditingDeck({ id: null, form: emptyDeck })}
            >
              <Icon name="add" size={18} /> Yeni deste
            </button>
          </div>
        }
      />

      <ErrorBox message={error} onRetry={loadDecks} />

      {loading ? (
        <PageLoader />
      ) : (
        <DataTable
          columns={['Deste', 'Konu', 'Kart', 'Çalışan', 'Sıra', 'Durum', '']}
          empty="Henüz deste yok."
        >
          {decks.length > 0 &&
            decks.map((d) => (
              <tr key={d.id} className="hover:bg-surface-container-low">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-left text-body-md text-on-surface hover:text-primary"
                    onClick={() => {
                      setDeckFilter(String(d.id));
                      setPage(0);
                    }}
                    title="Bu destenin kartlarını göster"
                  >
                    {d.title}
                  </button>
                  {d.is_premium && <span className="ml-2 text-caption text-primary">Premium</span>}
                  <div className="font-mono text-caption text-secondary">{d.slug}</div>
                </td>
                <td className="px-4 py-3 text-body-md text-secondary">{d.topic_name || '—'}</td>
                <td className="px-4 py-3 text-body-md text-secondary">{d.card_count}</td>
                <td className="px-4 py-3 text-body-md text-secondary">{d.learner_count}</td>
                <td className="px-4 py-3 text-body-md text-secondary">{d.sort_order}</td>
                <td className="px-4 py-3">
                  <StatusPill active={d.is_active} />
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    onEdit={() =>
                      setEditingDeck({
                        id: d.id,
                        form: {
                          topicId: d.topic_id || '',
                          title: d.title,
                          slug: d.slug,
                          description: d.description || '',
                          icon: d.icon || 'style',
                          isPremium: d.is_premium,
                          isActive: d.is_active,
                          sortOrder: d.sort_order,
                        },
                      })
                    }
                    onDelete={() => removeDeck(d)}
                  />
                </td>
              </tr>
            ))}
        </DataTable>
      )}

      {/* ------------------------------------------------------------ Kartlar */}

      <div className="mt-10 mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-headline-md text-on-surface">Kartlar</h2>
          <p className="text-body-md text-secondary">
            {cardTotal} kart{deckFilter ? ' (filtreli)' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto"
            value={deckFilter}
            onChange={(e) => {
              setDeckFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tüm desteler</option>
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <input
            className="input w-auto"
            placeholder="Kartlarda ara…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
          <button
            type="button"
            className="btn-primary"
            onClick={() =>
              setEditingCard({ id: null, form: { ...emptyCard, deckId: deckFilter || '' } })
            }
            disabled={decks.length === 0}
          >
            <Icon name="add" size={18} /> Yeni kart
          </button>
        </div>
      </div>

      {cardsLoading ? (
        <PageLoader />
      ) : (
        <DataTable
          columns={['Ön yüz', 'Arka yüz', 'Deste', 'Etiket', 'Durum', '']}
          empty="Bu filtreye uyan kart yok."
        >
          {cards.length > 0 &&
            cards.map((c) => (
              <tr key={c.id} className="hover:bg-surface-container-low">
                <td className="px-4 py-3 text-body-md text-on-surface">{short(c.front)}</td>
                <td className="px-4 py-3 text-body-md text-secondary">{short(c.back, 70)}</td>
                <td className="px-4 py-3 text-body-md text-secondary">{c.deck_title}</td>
                <td className="px-4 py-3 text-body-md text-secondary">{c.kind || '—'}</td>
                <td className="px-4 py-3">
                  <StatusPill active={c.is_active} />
                </td>
                <td className="px-4 py-3">
                  <RowActions
                    onEdit={() =>
                      setEditingCard({
                        id: c.id,
                        form: {
                          deckId: c.deck_id,
                          front: c.front,
                          back: c.back,
                          hint: c.hint || '',
                          kind: c.kind || '',
                          reference: c.reference || '',
                          sortOrder: c.sort_order,
                          isActive: c.is_active,
                        },
                      })
                    }
                    onDelete={() => removeCard(c)}
                  />
                </td>
              </tr>
            ))}
        </DataTable>
      )}

      {cardTotal > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className="btn-outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <Icon name="chevron_left" size={18} /> Önceki
          </button>
          <span className="text-body-md text-secondary">
            Sayfa {page + 1} / {lastPage + 1}
          </span>
          <button
            type="button"
            className="btn-outline"
            disabled={page >= lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Sonraki <Icon name="chevron_right" size={18} />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------ Modallar */}

      <Modal
        open={Boolean(editingDeck)}
        onClose={() => setEditingDeck(null)}
        title={editingDeck?.id ? 'Desteyi düzenle' : 'Yeni deste'}
      >
        {editingDeck && (
          <form onSubmit={saveDeck} className="space-y-4">
            <Field label="Başlık">
              <input
                className="input"
                required
                minLength={2}
                value={editingDeck.form.title}
                onChange={(e) => setDeckForm({ title: e.target.value })}
              />
            </Field>
            <Field label="Adres (slug)" hint="Boş bırakılırsa başlıktan üretilir.">
              <input
                className="input font-mono"
                value={editingDeck.form.slug}
                onChange={(e) => setDeckForm({ slug: e.target.value })}
                placeholder="kardiyovaskuler-farmakoloji"
              />
            </Field>
            <Field label="Açıklama">
              <textarea
                className="input"
                rows={3}
                value={editingDeck.form.description}
                onChange={(e) => setDeckForm({ description: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Konu">
                <select
                  className="input"
                  value={editingDeck.form.topicId}
                  onChange={(e) => setDeckForm({ topicId: e.target.value })}
                >
                  <option value="">Konusuz</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Simge" hint="Material Symbols adı.">
                <input
                  className="input"
                  value={editingDeck.form.icon}
                  onChange={(e) => setDeckForm({ icon: e.target.value })}
                />
              </Field>
              <Field label="Sıra">
                <input
                  type="number"
                  className="input"
                  value={editingDeck.form.sortOrder}
                  onChange={(e) => setDeckForm({ sortOrder: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-6">
              <Toggle
                checked={editingDeck.form.isPremium}
                onChange={(v) => setDeckForm({ isPremium: v })}
                label="Premium içerik"
              />
              <Toggle
                checked={editingDeck.form.isActive}
                onChange={(v) => setDeckForm({ isActive: v })}
                label="Yayında"
              />
            </div>
            <div className="flex justify-end gap-3 border-t border-surface-variant pt-4">
              <button type="button" className="btn-outline" onClick={() => setEditingDeck(null)}>
                Vazgeç
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Spinner /> : <Icon name="save" size={18} />} Kaydet
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(editingCard)}
        onClose={() => setEditingCard(null)}
        title={editingCard?.id ? 'Kartı düzenle' : 'Yeni kart'}
        wide
      >
        {editingCard && (
          <form onSubmit={saveCard} className="space-y-4">
            <Field label="Deste">
              <select
                className="input"
                required
                value={editingCard.form.deckId}
                onChange={(e) => setCardForm({ deckId: e.target.value })}
              >
                <option value="">Seçin…</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Ön yüz (soru)" hint="Basit HTML kullanılabilir; sunucuda temizlenir.">
              <textarea
                className="input"
                rows={3}
                required
                minLength={3}
                value={editingCard.form.front}
                onChange={(e) => setCardForm({ front: e.target.value })}
              />
            </Field>
            <Field label="Arka yüz (cevap)">
              <textarea
                className="input"
                rows={5}
                required
                minLength={3}
                value={editingCard.form.back}
                onChange={(e) => setCardForm({ back: e.target.value })}
              />
            </Field>
            <Field label="İpucu" hint="Kart çevrilmeden önce gösterilir.">
              <input
                className="input"
                value={editingCard.form.hint}
                onChange={(e) => setCardForm({ hint: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Etiket" hint="Örn. Kritik hata, Sınav vurgusu.">
                <input
                  className="input"
                  value={editingCard.form.kind}
                  onChange={(e) => setCardForm({ kind: e.target.value })}
                />
              </Field>
              <Field label="Kaynak">
                <input
                  className="input"
                  value={editingCard.form.reference}
                  onChange={(e) => setCardForm({ reference: e.target.value })}
                />
              </Field>
              <Field label="Sıra">
                <input
                  type="number"
                  className="input"
                  value={editingCard.form.sortOrder}
                  onChange={(e) => setCardForm({ sortOrder: e.target.value })}
                />
              </Field>
            </div>
            <Toggle
              checked={editingCard.form.isActive}
              onChange={(v) => setCardForm({ isActive: v })}
              label="Yayında"
            />
            <div className="flex justify-end gap-3 border-t border-surface-variant pt-4">
              <button type="button" className="btn-outline" onClick={() => setEditingCard(null)}>
                Vazgeç
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Spinner /> : <Icon name="save" size={18} />} Kaydet
              </button>
            </div>
          </form>
        )}
      </Modal>

      <BulkCardModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        decks={decks}
        defaultDeckId={deckFilter}
        onDone={() => {
          loadCards();
          loadDecks();
        }}
      />
    </div>
  );
}

/** JSON dizisiyle bir desteye toplu kart ekleme. */
function BulkCardModal({ open, onClose, decks, defaultDeckId, onDone }) {
  const toast = useToast();
  const [deckId, setDeckId] = useState(defaultDeckId || '');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState(null);

  useEffect(() => {
    if (open) {
      setDeckId(defaultDeckId || '');
      setCreated(null);
    }
  }, [open, defaultDeckId]);

  const example = JSON.stringify(
    [
      {
        front: 'Beta blokerlerde ani kesilme neden tehlikelidir?',
        back: 'Reseptör upregülasyonu nedeniyle rebound taşikardi, hipertansiyon ve iskemi riski.',
        kind: 'Kritik hata',
        reference: 'Bölüm 3.2',
      },
    ],
    null,
    2
  );

  const submit = async () => {
    let parsed;
    try {
      parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('JSON bir dizi olmalı.');
    } catch (err) {
      toast.error('JSON okunamadı', err.message);
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/admin/cards/bulk', { deckId: Number(deckId), cards: parsed });
      setCreated(res.createdCount);
      toast.success(`${res.createdCount} kart eklendi`);
      setText('');
      onDone();
    } catch (err) {
      toast.error('İçe aktarılamadı', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Toplu kart ekle" wide>
      <p className="mb-3 text-body-md text-secondary">
        Kartları JSON dizisi olarak yapıştırın. Tümü seçtiğiniz desteye, dizideki sırayla eklenir
        (en fazla 500 kart). Hatalı bir kayıt varsa hiçbiri eklenmez.
      </p>
      <Field label="Hedef deste">
        <select className="input" value={deckId} onChange={(e) => setDeckId(e.target.value)}>
          <option value="">Seçin…</option>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </Field>
      <details className="my-3">
        <summary className="cursor-pointer text-label-sm text-primary">Örnek format</summary>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-container-low p-3 text-caption">
          {example}
        </pre>
      </details>
      <textarea
        className="input min-h-[240px] font-mono text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="[ { … } ]"
      />
      {created !== null && (
        <div className="mt-3 rounded-lg bg-surface-container-low p-3 text-body-md text-success">
          {created} kart eklendi.
        </div>
      )}
      <div className="mt-4 flex justify-end gap-3">
        <button type="button" className="btn-outline" onClick={onClose}>
          Kapat
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={submit}
          disabled={busy || !text.trim() || !deckId}
        >
          {busy ? <Spinner /> : <Icon name="upload" size={18} />} İçe aktar
        </button>
      </div>
    </Modal>
  );
}
