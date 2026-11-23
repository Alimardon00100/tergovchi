import { useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { z } from 'zod';
import { profileUpdateSchema, publicUserSchema } from '@detective/shared';
import type { PublicUser, SafeProfile } from '@detective/shared';
import { api } from '../../shared/api/client';
import { usePicture } from '../../shared/lib/usePicture';
import { useQuietMotion } from '../../shared/lib/motion';
import { formatDate, formatNumber } from '../../shared/lib/presentation';
import { AvatarPhoto } from '../../shared/ui/AvatarPhoto';
import { Button } from '../../shared/ui/primitives';
import { RankInsignia } from './RankInsignia';
import { PasswordForm } from './PasswordForm';
type Values = z.infer<typeof profileUpdateSchema>;
export function FullProfileModal({
  profile,
  initialEdit = false,
  onClose,
  onUpdated,
}: {
  profile: SafeProfile;
  initialEdit?: boolean;
  onClose: () => void;
  onUpdated: (user: PublicUser) => Promise<void>;
}) {
  const quiet = useQuietMotion();
  const picture = usePicture();
  const fileInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(initialEdit);
  const [passwordEditing, setPasswordEditing] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { displayName: profile.displayName },
  });
  const persistIdentity = async (values: Values) => {
    let avatarSaved = false;
    if (picture.file) {
      const body = new FormData();
      body.append('image', picture.file);
      const user = await api('/users/me/avatar', publicUserSchema, { method: 'POST', body });
      await onUpdated(user);
      picture.clear();
      avatarSaved = true;
    }
    try {
      return await api('/users/me', publicUserSchema, {
        method: 'PATCH',
        body: JSON.stringify(values),
      });
    } catch (error) {
      if (avatarSaved)
        throw new Error(
          `Rasm saqlandi. Ismni qayta saqlang. ${error instanceof Error ? error.message : ''}`,
          { cause: error },
        );
      throw error;
    }
  };
  const save = useMutation({
    mutationFn: persistIdentity,
    onSuccess: async (user) => {
      await onUpdated(user);
      form.reset({ displayName: user.displayName });
      setEditing(false);
      setPasswordEditing(false);
      toast.success('Shaxsiy guvohnoma saqlandi.');
    },
    onError: (error) => form.setError('root', { message: error.message }),
  });

  const beforePasswordChange = async () => {
    if (picture.error) throw new Error(picture.error);
    if (!(await form.trigger())) throw new Error('Guvohnomadagi ism va familiyani tekshiring.');
    const values = form.getValues();
    if (values.displayName === profile.displayName && !picture.file) return false;
    const user = await persistIdentity(values);
    await onUpdated(user);
    form.reset({ displayName: user.displayName });
    return true;
  };
  const busy = save.isPending || passwordBusy;
  const photo = (
    <>
      <AvatarPhoto user={profile} />
      {picture.preview && (
        <img
          className="document-avatar-preview"
          src={picture.preview}
          alt="Tanlangan yangi avatar"
        />
      )}
      <span>{profile.avatarUrl || picture.preview ? 'Tergovchi' : 'Tergovchi_1'}</span>
    </>
  );
  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content asChild>
          <motion.section
            className="profile-document paper"
            style={{ x: '-50%', y: '-50%' }}
            initial={quiet ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: quiet ? 0 : 0.25 }}
          >
            <span className="paperclip" aria-hidden="true" />
            <span className="metal-paper-classification">SHAXSIY JILD · XIZMAT UCHUN</span>
            <Dialog.Title>To‘liq profil</Dialog.Title>
            <Dialog.Description>Guvohnoma va hisobingizga tegishli ma’lumotlar.</Dialog.Description>
            <div className="profile-document-body">
              <form
                id="full-profile-form"
                onSubmit={form.handleSubmit((values) => {
                  form.clearErrors('root');
                  save.mutate(values);
                })}
                aria-busy={save.isPending}
              >
                <div className="document-identity">
                  {editing ? (
                    <button
                      className="document-avatar"
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      aria-label="Avatar rasmini tanlash"
                      disabled={busy}
                    >
                      {photo}
                      <small>Rasmni almashtirish</small>
                    </button>
                  ) : (
                    <div className="document-avatar">{photo}</div>
                  )}
                  {editing && (
                    <input
                      ref={fileInput}
                      type="file"
                      className="sr-only"
                      aria-label="Avatar rasmini yuklash"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          picture.clear();
                          picture.choose(file);
                          form.clearErrors('root');
                        }
                        event.target.value = '';
                      }}
                    />
                  )}
                  <RankInsignia
                    rank={profile.rankName}
                    title={profile.rank.title}
                    className="document-rank"
                  />
                  <dl className="profile-document-facts">
                    <div>
                      <dt>Ism va familiya</dt>
                      <dd>
                        {editing ? (
                          <>
                            <input
                              className="document-name-input"
                              aria-label="Ism va familiya"
                              autoComplete="name"
                              disabled={busy}
                              aria-invalid={!!form.formState.errors.displayName}
                              {...form.register('displayName')}
                            />
                            <small className="field-error">
                              {form.formState.errors.displayName?.message}
                            </small>
                          </>
                        ) : (
                          profile.displayName
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Elektron pochta</dt>
                      <dd>{profile.email}</dd>
                    </div>
                    <div>
                      <dt>Xizmat unvoni</dt>
                      <dd>{profile.rank.title}</dd>
                    </div>
                    <div>
                      <dt>To‘plangan ball</dt>
                      <dd>{formatNumber(profile.points)} ball</dd>
                    </div>
                    <div>
                      <dt>Ro‘yxatdan o‘tgan sana</dt>
                      <dd>{formatDate(profile.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Hisob turi</dt>
                      <dd>{profile.role === 'ADMIN' ? 'Administrator' : 'Tergovchi'}</dd>
                    </div>
                    <div className="document-user-id">
                      <dt>Shaxsiy raqam</dt>
                      <dd>{profile.id}</dd>
                    </div>
                  </dl>
                </div>
                {picture.file && (
                  <p className="document-upload-note">
                    Yangi rasm tanlandi. Saqlash tugmasini bosing.
                  </p>
                )}
                {(picture.error || form.formState.errors.root) && (
                  <p className="metal-password-error" role="alert">
                    {picture.error || form.formState.errors.root?.message}
                  </p>
                )}
              </form>
              {editing && (
                <section className="document-password-section">
                  <button
                    type="button"
                    className="document-password-toggle"
                    aria-expanded={passwordEditing}
                    disabled={busy}
                    onClick={() => setPasswordEditing(!passwordEditing)}
                  >
                    Parolni o‘zgartirish
                  </button>
                  {passwordEditing && (
                    <PasswordForm
                      formId="full-profile-password-form"
                      beforeChange={beforePasswordChange}
                      onChanged={onClose}
                      onBusyChange={setPasswordBusy}
                    />
                  )}
                </section>
              )}
            </div>
            <div className="profile-document-footer">
              <button
                className="document-close-stamp"
                type="button"
                disabled={busy}
                onClick={onClose}
              >
                Yopish
              </button>
              {editing ? (
                <Button
                  key="save"
                  type="submit"
                  form={passwordEditing ? 'full-profile-password-form' : 'full-profile-form'}
                  className="document-save-stamp"
                  busy={save.isPending}
                  disabled={passwordBusy || !!picture.error}
                >
                  Saqlash
                </Button>
              ) : (
                <Button
                  key="edit"
                  type="button"
                  className="document-save-stamp"
                  onClick={(event) => {
                    event.preventDefault();
                    setEditing(true);
                  }}
                >
                  Tahrirlash
                </Button>
              )}
            </div>
          </motion.section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
