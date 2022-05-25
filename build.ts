import util from 'util'
import path from 'path'
import ncp from 'ncp'
import esbuild from 'esbuild'
import yargs from 'yargs-parser'

const { _, ...argv } = yargs(process.argv.slice(2)) ?? {}

const copyDir = util.promisify(ncp)

void esbuild
  .build({
    bundle: true,
    logLevel: 'info',
    platform: 'node',
    format: 'cjs',
    entryPoints: [
      './src/index.ts'
    ],
    outfile: './dist/index.js',
    external: [
      'batch',
      'vscode',
      'fsevents',
      'livereload-js'
    ],
    ...argv
  })
  .then(() => copyDir(path.join(require.resolve('serve-index'), '..', 'public'), './dist/public'))
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
