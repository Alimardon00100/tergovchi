import type { PublicUser } from '@detective/shared';
export function AvatarPhoto({ user }: { user: Pick<PublicUser, 'avatarUrl' | 'displayName'> }) {
  return (
    <img
      className="detective-avatar"
      src={user.avatarUrl ?? '/illustrations/detective-silhouette.svg'}
      alt={user.avatarUrl ? `${user.displayName} rasmi` : 'Tergovchi silueti'}
    />
  );
}
