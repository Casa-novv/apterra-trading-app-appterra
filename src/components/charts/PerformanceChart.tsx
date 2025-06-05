import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Box, Typography } from '@mui/material';

interface PerformanceChartProps {
  data?: {
    labels?: string[];
    data?: number[];
  };
  timeframe: '1D' | '1W' | '1M' | '3M' | '1Y';
  height: number;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, timeframe, height }) => {
  // State variable to force remount of the chart when data/timeframe changes
  const [chartKey, setChartKey] = useState(0);

  // Prepare chart data (using fallback values if none provided)
  const chartData = {
    labels: data?.labels || ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
      {
        label: 'Portfolio Performance',
        data: data?.data || [100, 110, 90, 120, 130],
        fill: false,
        borderColor: 'rgba(0, 212, 255, 1)',
        tension: 0.4,
      },
    ],
  };

  // Chart options (customize as needed)
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Portfolio Performance',
      },
    },
  };

  // Increment chartKey when timeframe or data changes to force remount.
  useEffect(() => {
    setChartKey((prevKey) => prevKey + 1);
  }, [timeframe, data]);

  return (
    <Box sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom>
        Portfolio Performance
      </Typography>
      <div style={{ height }}>
        <Line data={chartData} options={options} key={chartKey} />
      </div>
    </Box>
  );
};

export default PerformanceChart;