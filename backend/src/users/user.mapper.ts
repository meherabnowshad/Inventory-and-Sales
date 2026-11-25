interface UserRecord {
  id: bigint;
  name: string;
  username: string;
  email: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  role: { name: string };
  mustResetPw?: boolean;
}

export function mapUserToResponse(user: UserRecord) {
  return {
    id: Number(user.id),
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role.name,
    isActive: user.isActive,
    mustResetPw: user.mustResetPw ?? false,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
