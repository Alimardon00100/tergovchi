import { useQuery } from '@tanstack/react-query';
import { publicUserSchema, workspaceSchema } from '@detective/shared';
import { api } from './client';
export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api('/auth/me', publicUserSchema),
    retry: false,
    staleTime: 60000,
  });
export const useWorkspace = () =>
  useQuery({
    queryKey: ['workspace'],
    queryFn: () => api('/workspace', workspaceSchema),
    staleTime: 20000,
    refetchOnWindowFocus: true,
  });
