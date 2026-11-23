import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { caseWriteSchema } from '@detective/shared';
import { toast } from 'sonner';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useBoard } from '../../app/Layout';
import { api } from '../../shared/api/client';
import { usePicture } from '../../shared/lib/usePicture';
import { PaperSelect } from '../../shared/ui/PaperSelect';
import { Button, Empty } from '../../shared/ui/primitives';
import { SceneHeading } from '../../shared/scene/SceneObjects';
import { caseCode, difficultyLabels } from '../../shared/lib/presentation';
const schema = caseWriteSchema.omit({ slug: true, publication: true, coverAssetKey: true });
type Form = z.infer<typeof schema>;
export function Admin() {
  const data = useBoard();
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const picture = usePicture();
  const form = useForm<z.input<typeof schema>, unknown, Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      summary: '',
      description: '',
      difficulty: 'EASY',
      customPoints: null,
    },
  });
  const create = useMutation({
    mutationFn: (values: Form) => {
      if (!picture.file) throw new Error('Jinoyat ishi rasmi majburiy.');
      const body = new FormData();
      body.append('data', JSON.stringify(values));
      body.append('image', picture.file);
      return api('/admin/cases', z.object({ id: z.string().uuid() }), { method: 'POST', body });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['workspace'] });
      form.reset();
      picture.clear();
      setOpen(false);
      toast.success('Yangi ish tergov xonasiga qo‘shildi.');
    },
    onError: (error) => toast.error(error.message),
  });
  if (data.user.role !== 'ADMIN')
    return (
      <Empty title="Bu arxiv administrator uchun">
        Bu materiallarni boshqarish faqat administrator hisobida mumkin.
      </Empty>
    );
  return (
    <div className="archive-stage">
      <SceneHeading
        title="Maxfiy arxiv"
        eyebrow="FAQAT VAKOLATLI XODIMLAR UCHUN"
        description="Jinoyat ishlarining ro‘yxatga olish daftari."
      />
      <section className="archive-ledger paper">
        <span className="paperclip" />
        <span className="eyebrow">RO‘YXATGA OLINGAN ISHLAR</span>
        <h2>Arxiv daftari</h2>
        <div className="ledger-scroll">
          <table className="archive-table">
            <thead>
              <tr>
                <th>Ish raqami</th>
                <th>Nomi</th>
                <th>Daraja</th>
                <th>Ball</th>
              </tr>
            </thead>
            <tbody>
              {data.cases.map((entry) => (
                <tr key={entry.id}>
                  <td>{caseCode(entry)}</td>
                  <td>{entry.title}</td>
                  <td>{difficultyLabels[entry.difficulty]}</td>
                  <td>{entry.customPoints ?? entry.basePoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span className="ledger-count">{data.cases.length} ta ish ro‘yxatda</span>
      </section>
      <button
        className="archive-add paper"
        aria-label="Yangi ish qo‘shish"
        onClick={() => setOpen(true)}
      >
        <span className="wax-seal">+</span>
        <strong>Yangi ish qo‘shish</strong>
        <span>RO‘YXATGA OLISH</span>
      </button>
      <p className="archive-note paper">
        <span className="tape" />
        Ish rasmi majburiy. E’lon qilingan ish rasmi va ma’lumotlari tergov xonasida saqlanadi.
      </p>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="admin-dialog paper">
            <span className="paperclip" />
            <Dialog.Close className="dialog-close" aria-label="Yangi ish formasini yopish">
              <X size={24} />
            </Dialog.Close>
            <span className="eyebrow">ARXIV · YANGI VARAQA</span>
            <Dialog.Title>Yangi jinoyat ishi</Dialog.Title>
            <Dialog.Description>
              Vaziyat, ish surati va aniq ma’lumotlar kiriting.
            </Dialog.Description>
            <form
              onSubmit={form.handleSubmit((values) => {
                if (!picture.file) {
                  form.setError('root', { message: 'Jinoyat ishi rasmi majburiy.' });
                  return;
                }
                create.mutate(values);
              })}
            >
              <div className="case-picture-field">
                <label className="case-picture-pick">
                  <input
                    type="file"
                    className="sr-only"
                    aria-label="Jinoyat ishi rasmini yuklash"
                    aria-required="true"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      picture.choose(event.target.files?.[0]);
                      form.clearErrors('root');
                    }}
                  />
                  <span>
                    {picture.preview ? (
                      <img src={picture.preview} alt="Tanlangan jinoyat ishi rasmi" />
                    ) : (
                      <b>ISHDAGI SURAT</b>
                    )}
                  </span>
                  <strong>{picture.file ? 'Rasmni almashtirish' : 'Ish rasmini yuklash'}</strong>
                  <small>Majburiy · JPG, PNG, WebP · 4 MB gacha</small>
                </label>
                {(picture.error || form.formState.errors.root?.message) && (
                  <p className="field-error" role="alert">
                    {picture.error || form.formState.errors.root?.message}
                  </p>
                )}
              </div>
              <label className="form-field">
                Ish nomi
                <input {...form.register('title')} />
                <small className="field-error">{form.formState.errors.title?.message}</small>
              </label>
              <label className="form-field">
                Qisqa tavsif
                <textarea {...form.register('summary')} rows={2} />
                <small className="field-error">{form.formState.errors.summary?.message}</small>
              </label>
              <label className="form-field">
                To‘liq tafsilotlar
                <textarea {...form.register('description')} rows={3} />
                <small className="field-error">{form.formState.errors.description?.message}</small>
              </label>
              <div className="form-field form-field--half">
                <span>Qiyinchilik</span>
                <PaperSelect
                  label="Ish qiyinchiligi"
                  value={form.watch('difficulty')}
                  onChange={(value) =>
                    form.setValue('difficulty', schema.shape.difficulty.parse(value), {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  options={[
                    { value: 'EASY', label: 'Oson · 20 ball' },
                    { value: 'MEDIUM', label: 'O‘rta · 30 ball' },
                    { value: 'HARD', label: 'Murakkab · 50 ball' },
                  ]}
                />
              </div>
              <label className="form-field form-field--half">
                Maxsus ball
                <input
                  type="number"
                  min={0}
                  placeholder="Ixtiyoriy"
                  {...form.register('customPoints', {
                    setValueAs: (value: unknown) =>
                      value === '' || value === null || value === undefined ? null : Number(value),
                  })}
                />
                <small className="field-error">{form.formState.errors.customPoints?.message}</small>
              </label>
              <p className="form-hint">Maxsus ball bo‘sh bo‘lsa, daraja balli qo‘llanadi.</p>
              <Button type="submit" busy={create.isPending}>
                Ishni e’lon qilish
              </Button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
