import COS from 'cos-js-sdk-v5'

const COS_CONFIG_KEY = 'cos_config'

/**
 * 获取 COS 配置（优先从 localStorage 读取）
 */
export function getCosConfig() {
  try {
    const cached = localStorage.getItem(COS_CONFIG_KEY)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch {
    // ignore
  }
  // 默认配置
  return {
    bucket: '',
    region: 'ap-beijing',
    secretId: '',
    secretKey: ''
  }
}

/**
 * 保存 COS 配置到 localStorage
 */
export function saveCosConfig(config) {
  localStorage.setItem(COS_CONFIG_KEY, JSON.stringify(config))
}

/**
 * 创建 COS 实例
 */
function createCosInstance() {
  const config = getCosConfig()

  if (!config.bucket || !config.region) {
    throw new Error('请先配置存储桶信息')
  }

  // 如果有密钥，使用签名认证；否则尝试匿名访问
  const cosOptions = {
    Bucket: config.bucket,
    Region: config.region
  }

  if (config.secretId && config.secretKey) {
    cosOptions.SecretId = config.secretId
    cosOptions.SecretKey = config.secretKey
  }

  return new COS(cosOptions)
}

/**
 * 列出指定路径下的文件和文件夹
 * @param {string} prefix - 路径前缀
 * @returns {Promise<{folders: string[], files: object[]}>}
 */
export async function listObjects(prefix = '') {
  const config = getCosConfig()
  const cos = createCosInstance()

  const normalizedPrefix = prefix && !prefix.endsWith('/') ? prefix + '/' : prefix

  try {
    const data = await cos.getBucket({
      Bucket: config.bucket,
      Region: config.region,
      Prefix: normalizedPrefix,
      Delimiter: '/',
      MaxKeys: 100
    })

    const folders = []
    const files = []

    // 解析文件夹（CommonPrefixes）
    if (data.CommonPrefixes) {
      data.CommonPrefixes.forEach(item => {
        const folderPath = item.Prefix
        const folderName = folderPath.replace(normalizedPrefix, '').replace(/\/$/, '')
        if (folderName) folders.push(folderName)
      })
    }

    // 解析文件（Contents）
    if (data.Contents) {
      data.Contents.forEach(item => {
        const key = item.Key
        const fileName = key.replace(normalizedPrefix, '')

        // 跳过文件夹本身（以 / 结尾的 key）和空对象
        if (!fileName || fileName.endsWith('/')) return

        const isImage = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i.test(fileName)
        const url = `https://${config.bucket}.cos.${config.region}.myqcloud.com/${key}`

        files.push({
          key,
          name: fileName,
          size: parseInt(item.Size) || 0,
          lastModified: item.LastModified,
          url,
          isImage
        })
      })
    }

    return {
      folders: folders.sort(),
      files: files.sort((a, b) => a.name.localeCompare(b.name))
    }
  } catch (err) {
    console.error('[COS] List error:', err)
    throw err
  }
}

/**
 * 创建文件夹（在 COS 中创建一个以 / 结尾的空对象）
 * @param {string} folderPath - 文件夹路径（会自动确保以 / 结尾）
 * @returns {Promise<object>} 创建结果
 */
export async function createFolder(folderPath) {
  const config = getCosConfig()
  const cos = createCosInstance()

  if (!config.secretId || !config.secretKey) {
    throw new Error('创建文件夹需要配置 SecretId 和 SecretKey')
  }

  // 确保路径以 / 结尾
  const normalizedPath = folderPath.endsWith('/') ? folderPath : folderPath + '/'

  try {
    const result = await cos.putObject({
      Bucket: config.bucket,
      Region: config.region,
      Key: normalizedPath,
      Body: ''
    })
    return result
  } catch (err) {
    console.error('[COS] Create folder error:', err)
    throw err
  }
}

/**
 * 上传文件到 COS
 * @param {string} key - 文件在 COS 中的完整路径（包含文件名）
 * @param {File} file - 要上传的文件对象
 * @param {function} onProgress - 上传进度回调 (progress: number) => void
 * @returns {Promise<object>} 上传结果
 */
export async function uploadFile(key, file, onProgress) {
  const config = getCosConfig()
  const cos = createCosInstance()

  if (!config.secretId || !config.secretKey) {
    throw new Error('上传文件需要配置 SecretId 和 SecretKey')
  }

  try {
    const result = await cos.uploadFile({
      Bucket: config.bucket,
      Region: config.region,
      Key: key,
      Body: file,
      onProgress: (progressData) => {
        if (onProgress) {
          onProgress(progressData.percent)
        }
      }
    })
    return result
  } catch (err) {
    console.error('[COS] Upload error:', err)
    throw err
  }
}

/**
 * 从 URL 获取文件并上传到 COS
 * @param {string} key - 文件在 COS 中的完整路径
 * @param {string} url - 文件的远程 URL
 * @param {function} onProgress - 进度回调
 * @returns {Promise<object>}
 */
export async function uploadFileFromUrl(key, url, onProgress) {
  const config = getCosConfig()
  const cos = createCosInstance()

  if (!config.secretId || !config.secretKey) {
    throw new Error('上传文件需要配置 SecretId 和 SecretKey')
  }

  try {
    // 1. 从 URL 获取文件（使用 fetch 获取 blob）
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`获取文件失败：HTTP ${response.status}`)
    }
    const blob = await response.blob()

    // 2. 推断文件名和类型
    const urlParts = url.split('/')
    const originalName = urlParts[urlParts.length - 1] || 'video.mp4'
    const contentType = blob.type || 'video/mp4'

    // 3. 构造 File 对象
    const file = new File([blob], originalName, { type: contentType })

    // 4. 上传到 COS
    const result = await cos.uploadFile({
      Bucket: config.bucket,
      Region: config.region,
      Key: key,
      Body: file,
      onProgress: (progressData) => {
        if (onProgress) {
          onProgress(progressData.percent)
        }
      }
    })

    return result
  } catch (err) {
    console.error('[COS] Upload from URL error:', err)
    throw err
  }
}

/**
 * 格式化文件大小
 */
export function formatSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
