import { useApp } from '../context/AppContext'

export function PageNavigator() {
  const { numPages, currentPage, setCurrentPage } = useApp()

  if (numPages <= 0) return null

  const go = (page: number) => {
    if (page < 1 || page > numPages) return
    setCurrentPage(page)
  }

  return (
    <div className="flex items-center justify-center gap-3 bg-white px-3 py-2 shadow-sm">
      <button
        type="button"
        onClick={() => go(currentPage - 1)}
        disabled={currentPage <= 1}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="上一页"
      >
        ‹ 上一页
      </button>
      <div className="text-sm tabular-nums text-gray-700">
        第{' '}
        <input
          type="number"
          min={1}
          max={numPages}
          value={currentPage}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10)
            if (!Number.isNaN(v)) go(v)
          }}
          className="mx-1 inline-block w-12 rounded border border-gray-300 px-2 py-1 text-center text-sm focus:border-primary-500 focus:outline-none"
        />{' '}
        / {numPages} 页
      </div>
      <button
        type="button"
        onClick={() => go(currentPage + 1)}
        disabled={currentPage >= numPages}
        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="下一页"
      >
        下一页 ›
      </button>
    </div>
  )
}