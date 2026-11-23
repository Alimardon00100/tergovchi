import { clearCaseDrafts } from '../case-module/local-drafts';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { safeProfileSchema, safeCasesSchema } from '@detective/shared';
import type { SafeProfile, PublicUser } from '@detective/shared';
import { api } from '../../shared/api/client';
import { useQuietMotion } from '../../shared/lib/motion';
import { useSmallScene } from '../../shared/scene/SceneObjects';
import { SafeDoor } from './SafeDoor';
import { SafeShelves } from './SafeShelves';
import { FullProfileModal } from './FullProfileModal';
import { AllCasesModal } from './AllCasesModal';
import { PasswordDialog } from './PasswordDialog';
import './profile.css';
function SafeSign() {
  return (
    <div className="metal-safe-sign paper">
      <span>SHAXSIY METALL SEYF</span>
      <h1>Tergovchi profili</h1>
      <p>Guvohnoma, xizmat darajasi va jinoyat ishlari.</p>
    </div>
  );
}
export function SafeLayout() {
  const profile = useQuery({
    queryKey: ['safe-profile'],
    queryFn: () => api('/users/me', safeProfileSchema),
    retry: false,
  });
  const cases = useQuery({
    queryKey: ['safe-cases'],
    queryFn: () => api('/users/me/cases', safeCasesSchema),
    retry: false,
  });
  if (!profile.data || !cases.data)
    return (
      <div className="metal-safe-scene absolute inset-0">
        <SafeSign />
        <div className="metal-loading paper" role="status">
          {profile.isError || cases.isError ? (
            <>
              <p>{profile.error?.message ?? cases.error?.message}</p>
              <button
                onClick={() => {
                  void profile.refetch();
                  void cases.refetch();
                }}
              >
                Qayta tekshirish
              </button>
            </>
          ) : (
            'Shaxsiy seyf tayyorlanmoqda...'
          )}
        </div>
      </div>
    );
  return <SafeScene profile={profile.data} cases={cases.data} />;
}
function SafeScene({
  profile,
  cases,
}: {
  profile: SafeProfile;
  cases: z.infer<typeof safeCasesSchema>;
}) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const small = useSmallScene();
  const quiet = useQuietMotion();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<'profile' | 'shelves'>('profile');
  const [profileRequest, setProfileRequest] = useState<{ edit: boolean } | null>(null);
  const [allCases, setAllCases] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(true), quiet ? 0 : 450);
    return () => window.clearTimeout(timer);
  }, [quiet]);
  const updateUser = async (user: PublicUser) => {
    client.setQueryData(['me'], user);
    await Promise.all([
      client.invalidateQueries({ queryKey: ['workspace'] }),
      client.invalidateQueries({ queryKey: ['safe-profile'] }),
    ]);
  };
  const logout = useMutation({
    mutationFn: () => api('/auth/logout', z.object({ loggedOut: z.boolean() }), { method: 'POST' }),
    onSuccess: () => {
      clearCaseDrafts();
      client.clear();
      navigate('/login', { replace: true });
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <div className="metal-safe-scene absolute inset-0">
      <SafeSign />
      <div className="metal-safe" data-state={open ? 'open' : 'closed'} data-panel={panel}>
        <SafeShelves
          opened={cases.opened}
          unopened={cases.unopened}
          hidden={!open || (small && panel === 'profile')}
          onViewAll={() => setAllCases(true)}
        />
        <SafeDoor
          profile={profile}
          open={open}
          small={small}
          panel={panel}
          onOpenChange={setOpen}
          onProfile={(edit) => setProfileRequest({ edit })}
          onPassword={() => setPasswordOpen(true)}
          onLogout={() => logout.mutate()}
          loggingOut={logout.isPending}
        />
      </div>
      {small && open && (
        <div className="metal-view-switch" aria-label="Seyf bo‘limlari">
          <button
            className="metal-button"
            aria-pressed={panel === 'shelves'}
            onClick={() => setPanel('shelves')}
          >
            Javonlar
          </button>
          <button
            className="metal-button"
            aria-pressed={panel === 'profile'}
            onClick={() => setPanel('profile')}
          >
            Profil
          </button>
        </div>
      )}
      {profileRequest && (
        <FullProfileModal
          profile={profile}
          initialEdit={profileRequest.edit}
          onClose={() => setProfileRequest(null)}
          onUpdated={updateUser}
        />
      )}
      {allCases && (
        <AllCasesModal
          entries={[...cases.opened, ...cases.unopened].sort(
            (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
          )}
          onClose={() => setAllCases(false)}
        />
      )}
      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
