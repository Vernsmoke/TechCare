export type User = {
  id: number;
  name: string;
  email?: string;
  role: 'member' | 'moderator' | 'admin';
  bio: string;
  avatar: string;
  visibility: 'public' | 'private';
  friendship?: 'none' | 'friends' | 'incoming' | 'outgoing';
  following?: boolean;
  blocked?: boolean;
  verified?: number;
};
export type Announcement = {
  id: number;
  title: string;
  description: string;
  image: string;
  alt: string;
  date: string;
  link: string;
  status?: 'draft' | 'published';
  position?: number;
  revision?: number;
};
export type Post = {
  photo?: string;
  id: number;
  title: string;
  body: string;
  category: string;
  name: string;
  role: string;
  avatar: string;
  status: string;
  created: number;
  replies: number;
};
export type Reply = {
  id: number;
  body: string;
  name: string;
  role: string;
  avatar: string;
  created: number;
};
export type Notice = {
  id: number;
  kind: string;
  item: string;
  details: string;
  location: string;
  created: number;
  name?: string;
};
export type Resource = {
  id: number;
  title: string;
  description: string;
  category: string;
  type: string;
  url: string;
  author: string;
};
export type Message = {
  id: number;
  sender: number;
  receiver: number;
  body: string;
  created: number;
};
export type Queue = {
  posts: Post[];
  comments: (Reply & { title: string })[];
  reports: Notice[];
  feedback: { id: number; name: string; rating: number; message: string }[];
  messageReports: { id: number; name: string; body: string; reason: string }[];
};
export type Dashboard = { following: User[]; followers: User[]; posts: Post[]; hasMore: boolean };
export type FormValues = Record<string, string>;
export type Result = {
  message?: string;
  user?: User;
  development_code?: string;
  development_token?: string;
  hero?: string;
  id?: number;
};
