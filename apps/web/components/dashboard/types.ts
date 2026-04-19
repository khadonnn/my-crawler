export type GrowthPoint = {
  day: string;
  value: number;
};

export type QualityPoint = {
  name: "Potential" | "Neutral";
  value: number;
};

export type RunningTask = {
  id: string;
  sourceType: string;
  sourceValue: string;
  status: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

export type DashboardPayload = {
  kpis: {
    totalLeads: number;
    runningTasks: number;
  };
  growth: GrowthPoint[];
  quality: QualityPoint[];
  runningTasks: RunningTask[];
  updatedAt: string;
};

export type WorkerHealthPayload = {
  online: boolean;
  status: string;
  checkedAt: string;
  baseUrl?: string;
  message?: string;
};

export type ProxyHealthPayload = {
  total: number;
  working: number;
  liveRate: number;
  hasData: boolean;
  checkedAt: string;
  message?: string;
};
