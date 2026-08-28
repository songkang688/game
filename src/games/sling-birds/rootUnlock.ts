/**
 * 管理员权限(kangkang 密码,src/ui/root12Contract 的共享会话)与本游戏
 * 自己的星级解锁的合流口径:root 开着全关可进,关着/过期回落到原判定。
 * 抽成纯函数是为了让「root 开则全开」这件事能被单测直接问。
 */
export function unlockedWithRoot(rootOpen: boolean, baseUnlocked: boolean): boolean {
  return rootOpen || baseUnlocked;
}
