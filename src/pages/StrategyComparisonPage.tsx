import { useState, useCallback, useRef } from 'react'
import { Upload, FileText, X, Calendar, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface StrategyData {
  name: string
  data: Array<{
    date: string
    returnRate: number
    year: number
    month: number
  }>
}

interface ParsedCSVData {
  date: string
  returnRate: number
}

function parseCSV(content: string, fileName: string): StrategyData | null {
  const lines = content.split('\n').filter(line => line.trim())
  console.log('Total lines:', lines.length)
  
  if (lines.length < 2) {
    console.log('Not enough lines')
    return null
  }

  const headers = lines[0].split(',').map(h => h.trim())
  console.log('Headers:', headers)
  
  const dateIndex = headers.findIndex(h => h === '日期')
  const marketValueIndex = headers.findIndex(h => h === '市值/价值')

  if (dateIndex === -1) {
    console.log('Date column not found')
    return null
  }

  if (marketValueIndex === -1) {
    console.log('Market value column not found')
    console.log('Available headers:', headers)
    return null
  }

  console.log('Using column: marketValue=', headers[marketValueIndex])

  const dailyData = new Map<string, number>()

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    if (values.length <= dateIndex || values.length <= marketValueIndex) continue

    const dateStr = values[dateIndex]
    const marketValueStr = values[marketValueIndex]

    if (!dateStr) continue

    const marketValue = parseFloat(marketValueStr) || 0

    if (!dailyData.has(dateStr)) {
      dailyData.set(dateStr, 0)
    }

    dailyData.set(dateStr, dailyData.get(dateStr)! + marketValue)
  }

  const sortedDates = Array.from(dailyData.keys()).sort()
  const data: ParsedCSVData[] = []
  
  const firstDate = sortedDates[0]
  const initialTotalMarketValue = dailyData.get(firstDate)!

  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = sortedDates[i]
    const totalMarketValue = dailyData.get(dateStr)!

    const cumulativeReturn = ((totalMarketValue / initialTotalMarketValue) - 1) * 100

    const [year, month, _day] = dateStr.split('-').map(Number)
    
    if (!isNaN(year) && !isNaN(month)) {
      data.push({
        date: dateStr,
        returnRate: cumulativeReturn,
      })
    }
  }

  console.log('Parsed data points:', data.length)

  if (data.length === 0) {
    console.log('No valid data points found')
    return null
  }

  console.log('First data point:', data[0])
  console.log('Last data point:', data[data.length - 1])

  return {
    name: fileName.replace('.csv', ''),
    data: data.map(d => ({
      ...d,
      year: parseInt(d.date.split('-')[0]),
      month: parseInt(d.date.split('-')[1]),
    })),
  }
}

export function StrategyComparisonPage() {
  const [strategies, setStrategies] = useState<StrategyData[]>([])
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const processFiles = useCallback(async (files: File[]) => {
    console.log('Processing files:', files.length)
    const csvFiles = files.filter(f => f.name.endsWith('.csv'))
    console.log('CSV files found:', csvFiles.length)
    
    for (const file of csvFiles) {
      console.log('Processing file:', file.name)
      try {
        const content = await readFileAsText(file)
        console.log('File content length:', content.length)
        const parsed = parseCSV(content, file.name)
        
        if (parsed) {
          console.log('Parsed successfully:', parsed.name, 'Data points:', parsed.data.length)
          setStrategies(prev => {
            const existing = prev.find(s => s.name === parsed.name)
            if (existing) {
              console.log('Updating existing strategy:', parsed.name)
              return prev.map(s => s.name === parsed.name ? parsed : s)
            }
            console.log('Adding new strategy:', parsed.name)
            return [...prev, parsed]
          })
        } else {
          console.error('Failed to parse file:', file.name)
        }
      } catch (error) {
        console.error('Error processing file:', file.name, error)
      }
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    console.log('Drop event triggered')
    console.log('DataTransfer:', e.dataTransfer)
    console.log('Files:', e.dataTransfer.files)
    console.log('Files length:', e.dataTransfer.files.length)

    const files = Array.from(e.dataTransfer.files)
    console.log('Processing dropped files:', files.length)
    processFiles(files)
  }, [processFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    processFiles(files)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }, [processFiles])

  async function readFileAsText(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      
      const gbkDecoder = new TextDecoder('gbk')
      const gbkText = gbkDecoder.decode(arrayBuffer)
      console.log('Decoded with GBK')
      
      const headers = gbkText.split('\n')[0].split(',').map(h => h.trim())
      console.log('GBK headers:', headers)
      
      const hasExpectedHeaders = headers.some(h => h === '日期' || h === '累计盈亏比例')
      
      if (hasExpectedHeaders) {
        console.log('Expected Chinese headers found, using GBK encoding')
        return gbkText
      } else {
        console.log('Expected headers not found in GBK, trying UTF-8')
        const utf8Decoder = new TextDecoder('utf-8')
        const utf8Text = utf8Decoder.decode(arrayBuffer)
        console.log('Decoded with UTF-8')
        console.log('UTF-8 headers:', utf8Text.split('\n')[0].split(',').map(h => h.trim()))
        return utf8Text
      }
    } catch (error) {
      console.error('Error decoding file:', error)
      throw error
    }
  }

  const removeStrategy = (name: string) => {
    setStrategies(prev => prev.filter(s => s.name !== name))
  }

  const clearAll = () => {
    setStrategies([])
    setSelectedMonth(null)
  }

  const getChartData = () => {
    if (strategies.length === 0) return []

    if (selectedMonth !== null) {
      const monthlyData: Record<string, Record<string, number>> = {}

      strategies.forEach(strategy => {
        const yearData: Record<number, Array<{date: string, returnRate: number}>> = {}

        strategy.data.forEach(point => {
          if (point.month === selectedMonth) {
            if (!yearData[point.year]) {
              yearData[point.year] = []
            }
            yearData[point.year].push({
              date: point.date,
              returnRate: point.returnRate
            })
          }
        })

        Object.entries(yearData).forEach(([year, points]) => {
          if (points.length >= 1) {
            const sortedPoints = points.sort((a, b) => a.date.localeCompare(b.date))
            const lastDayOfMonth = sortedPoints[sortedPoints.length - 1]
            const firstDayOfMonth = sortedPoints[0]
            
            const yearNum = parseInt(year)
            const prevYear = selectedMonth === 1 ? yearNum - 1 : yearNum
            const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
            
            const prevMonthLastDay = strategy.data
              .filter(d => d.year === prevYear && d.month === prevMonth)
              .sort((a, b) => a.date.localeCompare(b.date))
              .pop()

            let initialReturnRate: number
            if (prevMonthLastDay) {
              initialReturnRate = prevMonthLastDay.returnRate
            } else {
              initialReturnRate = firstDayOfMonth.returnRate
            }

            const monthlyReturn = ((1 + lastDayOfMonth.returnRate / 100) / (1 + initialReturnRate / 100) - 1) * 100

            const key = `${yearNum}年${selectedMonth}月`
            if (!monthlyData[key]) {
              monthlyData[key] = { year: yearNum, month: selectedMonth }
            }
            monthlyData[key][strategy.name] = monthlyReturn
          }
        })
      })

      return Object.entries(monthlyData)
        .map(([key, values]) => ({
          date: key,
          year: values.year,
          month: values.month,
          ...Object.fromEntries(
            Object.entries(values).filter(([k]) => k !== 'year' && k !== 'month')
          ),
        }))
        .sort((a, b) => a.year - b.year)
    } else {
      const allDates = new Set<string>()
      strategies.forEach(s => s.data.forEach(d => allDates.add(d.date)))

      return Array.from(allDates)
        .sort()
        .map(date => {
          const point: Record<string, string | number | null> = { date }
          strategies.forEach(strategy => {
            const dataPoint = strategy.data.find(d => d.date === date)
            point[strategy.name] = dataPoint?.returnRate ?? null
          })
          return point
        })
    }
  }

  const chartData = getChartData()
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f']

  const getMonthOptions = () => {
    const months = new Set<number>()
    strategies.forEach(s => s.data.forEach(d => months.add(d.month)))
    return Array.from(months).sort((a, b) => a - b)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">策略对比</h1>
        <p className="text-lg text-muted-foreground">
          拖入聚宽量化导出的回测持仓&收益CSV文件，对比不同策略的收益率
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            上传策略文件
          </CardTitle>
          <CardDescription>
            支持拖拽或点击上传多个CSV文件
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">拖拽CSV文件到这里</p>
            <p className="text-sm text-muted-foreground mb-4">或者</p>
            <Button onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.click()
            }}>
              选择文件
            </Button>
          </div>

          {strategies.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">已加载的策略</h3>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  清空全部
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {strategies.map((strategy, index) => (
                  <Badge
                    key={strategy.name}
                    variant="secondary"
                    className="flex items-center gap-1 text-sm"
                    style={{ backgroundColor: `${colors[index % colors.length]}20`, color: colors[index % colors.length] }}
                  >
                    <FileText className="h-3 w-3" />
                    {strategy.name}
                    <button
                      onClick={() => removeStrategy(strategy.name)}
                      className="ml-1 hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {strategies.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                月份筛选
              </CardTitle>
              <CardDescription>
                选择特定月份对比历年该月份的收益率
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={selectedMonth === null ? 'default' : 'outline'}
                  onClick={() => setSelectedMonth(null)}
                >
                  全部
                </Button>
                {getMonthOptions().map(month => (
                  <Button
                    key={month}
                    variant={selectedMonth === month ? 'default' : 'outline'}
                    onClick={() => setSelectedMonth(month)}
                  >
                    {month}月
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                收益率对比图表
                {selectedMonth !== null && (
                  <Badge variant="secondary">{selectedMonth}月</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {selectedMonth !== null
                  ? `对比各策略在${selectedMonth}月份的历年收益率`
                  : '对比各策略的累计收益率曲线'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      label={{ value: '收益率 (%)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      formatter={(value: number | undefined) => [`${value?.toFixed(2) ?? 0}%`, '收益率']}
                      labelFormatter={(label) => `日期: ${label}`}
                    />
                    <Legend />
                    {strategies.map((strategy, index) => (
                      <Line
                        key={strategy.name}
                        type="monotone"
                        dataKey={strategy.name}
                        stroke={colors[index % colors.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>数据统计</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {strategies.map((strategy, index) => {
                  const latestData = strategy.data[strategy.data.length - 1]
                  const maxReturn = Math.max(...strategy.data.map(d => d.returnRate))
                  const minReturn = Math.min(...strategy.data.map(d => d.returnRate))
                  
                  return (
                    <div
                      key={strategy.name}
                      className="space-y-2 p-4 rounded-lg border"
                      style={{ borderColor: colors[index % colors.length] }}
                    >
                      <h4 className="font-semibold" style={{ color: colors[index % colors.length] }}>
                        {strategy.name}
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">最新收益率:</span>
                          <span className={latestData?.returnRate >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {latestData ? `${latestData.returnRate.toFixed(2)}%` : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">最高收益率:</span>
                          <span className="text-green-600">{maxReturn.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">最低收益率:</span>
                          <span className="text-red-600">{minReturn.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">数据点数:</span>
                          <span>{strategy.data.length}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
