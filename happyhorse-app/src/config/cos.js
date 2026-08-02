/**
 * 腾讯云 COS 配置
 *
 * 两种模式：
 * 1. proxyMode: true  — 通过后端代理访问（推荐，安全）
 *    设置 proxyUrl 为代理地址，可选 proxyAuth 为认证头
 *
 * 2. proxyMode: false — 直接访问 COS（需 Bucket 开启公共读）
 *    设置 bucket 和 region
 */
export const cosConfig = {
  // 是否使用代理模式
  proxyMode: false,

  // 代理地址（proxyMode 为 true 时使用）
  proxyUrl: '/api/cos',

  // 代理认证头（可选）
  proxyAuth: '',

  // COS Bucket 名称
  bucket: 'your-bucket-name',

  // COS 地域，如 ap-beijing, ap-shanghai, ap-guangzhou
  region: 'ap-beijing',

  // 单次列出最大文件数
  maxKeys: 100
}
