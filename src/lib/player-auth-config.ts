export function playerAuthPepper() {
  const pepper = process.env.PLAYER_AUTH_PEPPER;
  return pepper && pepper.length >= 32 ? pepper : null;
}
