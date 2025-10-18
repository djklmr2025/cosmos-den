import { API_BASE } from '../lib/env';
import { request, jsonPost } from '../lib/http';

export type FsItem = { name: string; path: string; type: 'dir' | 'file' };

export async function listDir(path = '.'): Promise<FsItem[]> {
  const url = `${API_BASE}/fs/list`;
  const data = await request(url, jsonPost({ path }));
  return data?.items ?? [];
}

export async function readFile(path: string): Promise<string> {
  const url = `${API_BASE}/fs/read`;
  const data = await request(url, jsonPost({ path }));
  return data?.content ?? '';
}

export async function writeFile(path: string, content: string): Promise<void> {
  const url = `${API_BASE}/fs/write`;
  await request(url, jsonPost({ path, content }));
}