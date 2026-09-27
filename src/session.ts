// The tenant the signed-in user is currently working in.
let tenant: string | null = null;

export const setActiveTenant = (t: string | null) => { tenant = t; };

export const activeTenant = (): string => {
  if (!tenant) throw new Error('No active tenant');
  return tenant;
};
