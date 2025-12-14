"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import LoadingScreen from "../../../components/LoadingScreen";

type BudgetLevel = "low" | "medium" | "high";
type ActivityLevel = "low" | "medium" | "high";
type TravelGroup = "solo" | "couple" | "family" | "friends";

function toLocalISO(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayISO() {
  return toLocalISO(new Date());
}

function toDateAtMidnight(dateISO: string) {
  // tránh lệch múi giờ khi new Date("YYYY-MM-DD")
  return new Date(`${dateISO}T00:00:00`);
}

function addDaysISO(dateISO: string, days: number) {
  const d = toDateAtMidnight(dateISO);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

function formatDisplayDate(dateISO: string) {
  if (!dateISO) return "";
  try {
    const d = toDateAtMidnight(dateISO);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return dateISO;
  }
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(d: Date, delta: number) {
  const next = new Date(d);
  next.setDate(1);
  next.setMonth(next.getMonth() + delta);
  return next;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function isSameISO(a: string, b: string) {
  return Boolean(a && b && a === b);
}

function clampISOToRange(iso: string, minISO: string, maxISO: string) {
  const v = toDateAtMidnight(iso);
  const minV = toDateAtMidnight(minISO);
  const maxV = toDateAtMidnight(maxISO);
  if (v < minV) return minISO;
  if (v > maxV) return maxISO;
  return iso;
}

function diffDaysInclusive(startISO: string, endISO: string) {
  const start = toDateAtMidnight(startISO);
  const end = toDateAtMidnight(endISO);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

function vnBudgetLabel(v: BudgetLevel) {
  if (v === "low") return "Tiết kiệm";
  if (v === "medium") return "Trung bình";
  return "Cao cấp";
}

function vnActivityLabel(v: ActivityLevel) {
  if (v === "low") return "Thấp";
  if (v === "medium") return "Trung bình";
  return "Cao";
}

function vnGroupLabel(v: TravelGroup) {
  if (v === "solo") return "Một mình";
  if (v === "couple") return "Cặp đôi";
  if (v === "family") return "Gia đình";
  return "Nhóm bạn";
}

function Tip({
  text,
  children,
  position = "tooltip-top",
}: {
  text: string;
  children: React.ReactNode;
  // Allow arbitrary class strings (e.g. "tooltip-left before:w-36 before:whitespace-normal")
  position?: string;
}) {
  return (
    <div className={`tooltip ${position} relative z-[9999]`} data-tip={text}>
      {children}
    </div>
  );
}

function SectionTitle({
  title,
  tip,
  icon,
}: {
  title: string;
  tip: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="text-base font-semibold text-slate-800">{title}</div>
      </div>
      <div className="flex items-center gap-2">
        {icon}
        <Tip text={tip} position="tooltip-left">
          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs flex items-center justify-center cursor-help select-none">
            ?
          </div>
        </Tip>
      </div>
    </div>
  );
}

export default function TripInputPage() {
  const router = useRouter();
  const { user, loading: authLoading, signInAnon, getIdToken } = useAuth();

  const MAX_TRIP_DAYS = 3;
  const MAX_TRIP_END_OFFSET = MAX_TRIP_DAYS - 1; // inclusive range

  const [destination, setDestination] = useState("");
  const [journeyStart, setJourneyStart] = useState("");
  const [journeyEnd, setJourneyEnd] = useState("");

  const [budget, setBudget] = useState<BudgetLevel>("medium");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>("medium");

  const [travelGroup, setTravelGroup] = useState<TravelGroup>("solo");
  const [groupSize, setGroupSize] = useState<number>(1);

  const [travelMode, setTravelMode] = useState<string>("Đi bộ");
  const [categories, setCategories] = useState<string[]>([]);
  const [otherOptions, setOtherOptions] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState("");

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const base = journeyStart ? toDateAtMidnight(journeyStart) : new Date();
    return startOfMonth(base);
  });
  const [calendarPicking, setCalendarPicking] = useState<"start" | "end">(
    "start"
  );

  useEffect(() => {
    if (!journeyStart) return;
    setCalendarMonth(startOfMonth(toDateAtMidnight(journeyStart)));
  }, [journeyStart]);

  // Auto sign-in anonymously if not authenticated
  useEffect(() => {
    const handleAuth = async () => {
      if (!authLoading && !user) {
        try {
          await signInAnon();
        } catch (e) {
          console.error("Failed to sign in anonymously:", e);
          router.push("/auth");
        }
      }
    };
    handleAuth();
  }, [user, authLoading, router, signInAnon]);

  // group size rules
  useEffect(() => {
    if (travelGroup === "solo") {
      setGroupSize(1);
      return;
    }
    if (travelGroup === "couple") {
      setGroupSize(2);
      return;
    }
    if (travelGroup === "family") {
      setGroupSize((prev) => Math.min(6, Math.max(2, prev)));
      return;
    }
    setGroupSize((prev) => Math.min(10, Math.max(2, prev)));
  }, [travelGroup]);

  const duration = useMemo(() => {
    if (!journeyStart || !journeyEnd) return 0;
    const d = diffDaysInclusive(journeyStart, journeyEnd);
    return Number.isFinite(d) ? d : 0;
  }, [journeyStart, journeyEnd]);

  const summaryPreferences = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Ngân sách: ${vnBudgetLabel(budget)}`);
    lines.push(`Mức độ hoạt động: ${vnActivityLabel(activityLevel)}`);
    lines.push(
      `Nhóm du lịch: ${vnGroupLabel(travelGroup)}${
        travelGroup === "solo" ? "" : ` (${groupSize} người)`
      }`
    );
    lines.push(`Cách du lịch: ${travelMode}`);
    if (categories.length > 0) lines.push(`Danh mục: ${categories.join(", ")}`);
    if (journeyStart && journeyEnd)
      lines.push(
        `Thời gian: ${formatDisplayDate(journeyStart)} - ${formatDisplayDate(journeyEnd)} (${duration} ngày)`
      );
    return lines.join("\n");
  }, [
    budget,
    activityLevel,
    travelGroup,
    groupSize,
    travelMode,
    categories,
    journeyStart,
    journeyEnd,
    duration,
  ]);

  const categoryOptions = useMemo(
    () => [
      {
        value: "Văn hóa",
        tip: "Bảo tàng, lễ hội, làng nghề, nghệ thuật địa phương.",
      },
      {
        value: "Thiên nhiên",
        tip: "Biển, núi, công viên, cảnh quan thiên nhiên.",
      },
      { value: "Ẩm thực", tip: "Món đặc sản, chợ/food tour, quán địa phương." },
      { value: "Phiêu lưu", tip: "Trekking, thể thao, trải nghiệm mạo hiểm." },
      { value: "Mua sắm", tip: "Chợ, trung tâm thương mại, đặc sản mua về." },
      {
        value: "Giải trí đêm",
        tip: "Phố đi bộ, quán bar, hoạt động buổi tối.",
      },
      { value: "Thư giãn", tip: "Spa, nghỉ dưỡng, lịch trình nhẹ nhàng." },
      { value: "Lịch sử", tip: "Di tích, địa danh lịch sử, kiến trúc cổ." },
      { value: "Nhiếp ảnh", tip: "Điểm check-in, ngắm hoàng hôn/bình minh." },
    ],
    []
  );

  const travelModeOptions = useMemo(
    () => [
      { value: "Đi bộ", tip: "Ưu tiên điểm gần nhau, phù hợp khu trung tâm." },
      { value: "Xe máy", tip: "Linh hoạt, phù hợp di chuyển trong nội thành." },
      { value: "Ô tô", tip: "Thoải mái, phù hợp nhóm/đi xa." },
      {
        value: "Phương tiện công cộng",
        tip: "Ưu tiên bus/metro/taxi công nghệ khi cần.",
      },
      { value: "Xe đạp", tip: "Phù hợp đường ngắn, trải nghiệm chậm." },
    ],
    []
  );

  const handleDateChangeStart = (val: string) => {
    setJourneyStart(val);

    // nếu chưa chọn end hoặc end < start => set end = start
    if (
      !journeyEnd ||
      (val &&
        journeyEnd &&
        toDateAtMidnight(journeyEnd) < toDateAtMidnight(val))
    ) {
      setJourneyEnd(val);
      return;
    }

    // nếu end vượt quá start + (MAX_TRIP_DAYS - 1) => kéo end về max
    const maxISO = val ? addDaysISO(val, MAX_TRIP_END_OFFSET) : "";
    if (
      maxISO &&
      journeyEnd &&
      toDateAtMidnight(journeyEnd) > toDateAtMidnight(maxISO)
    ) {
      setJourneyEnd(maxISO);
    }
  };

  const handleDateChangeEnd = (val: string) => {
    if (!journeyStart) {
      setJourneyEnd(val);
      return;
    }

    // clamp end >= start
    if (val && toDateAtMidnight(val) < toDateAtMidnight(journeyStart)) {
      setJourneyEnd(journeyStart);
      return;
    }

    // clamp end <= start+(MAX_TRIP_DAYS - 1)
    const maxISO = addDaysISO(journeyStart, MAX_TRIP_END_OFFSET);
    if (val && toDateAtMidnight(val) > toDateAtMidnight(maxISO)) {
      setJourneyEnd(maxISO);
      return;
    }

    setJourneyEnd(val);
  };

  const toggleCategory = (value: string) => {
    setCategories((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value]
    );
  };

  const setExclusiveTravelMode = (value: string) => {
    setTravelMode(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!destination.trim()) {
      setError("Vui lòng nhập địa điểm.");
      return;
    }
    if (!journeyStart || !journeyEnd) {
      setError("Vui lòng chọn ngày bắt đầu và ngày kết thúc.");
      return;
    }

    const d = diffDaysInclusive(journeyStart, journeyEnd);
    if (!Number.isFinite(d) || d < 1 || d > MAX_TRIP_DAYS) {
      setError(`Thời gian chuyến đi phải từ 1 đến ${MAX_TRIP_DAYS} ngày.`);
      return;
    }

    const mergedPreferences = [
      (otherOptions || "").trim(),
      "",
      "— Thông tin lựa chọn —",
      summaryPreferences,
    ]
      .join("\n")
      .trim();

    const payload = {
      destination: destination.trim(),
      duration: d,
      budget,
      start_date: journeyStart,
      preferences: mergedPreferences,
      activity_level: activityLevel,
      travel_group: travelGroup, // giữ schema cũ
      group_size: groupSize,
      travel_mode: travelMode,
      categories,
      active_time_start: 9,
      active_time_end: 21,
    };

    setIsLoading(true);
    setLoadingProgress(0);

    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 3 + 1;
      });
    }, 200);

    let ok = false;

    try {
      setLoadingProgress(10);
      const token = await getIdToken();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      setLoadingProgress(30);
      const response = await fetch("/api/plan-trip", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      setLoadingProgress(80);

      if (!response.ok) {
        throw new Error("Tạo kế hoạch chuyến đi thất bại.");
      }

      const tripPlan = await response.json();

      setLoadingProgress(95);

      localStorage.setItem("tripPlan", JSON.stringify(tripPlan));
      localStorage.setItem("tripParams", JSON.stringify(payload));

      setLoadingProgress(100);
      ok = true;

      setTimeout(() => {
        router.push("/trip/plan");
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      clearInterval(progressInterval);
      if (!ok) {
        setIsLoading(false);
        setLoadingProgress(0);
      }
    }
  };

  return (
    <>
      {isLoading && <LoadingScreen progress={loadingProgress} />}

      <div className="min-h-screen bg-linear-to-br from-blue-50 via-blue-50 to-teal-50">
        {/* Navbar */}
        <div className="navbar bg-white/90 backdrop-blur shadow-sm">
          <div className="navbar-start">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="btn btn-ghost text-lg"
            >
              <span>← Quay lại</span>
            </button>
          </div>
          <div className="navbar-center">
            <div className="text-2xl font-bold text-transparent bg-clip-text bg-linear-to-r from-blue-500 via-blue-500 to-teal-500">
              Pocket Atlas
            </div>
          </div>
          <div className="navbar-end" />
        </div>

        <div className="container mx-auto px-4 py-10 max-w-6xl">
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
              Tạo chuyến đi dài ngày
            </h1>
            <p className="text-slate-600 mt-2">
              Điền thông tin để hệ thống tạo kế hoạch phù hợp.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Destination */}
              <div className="card bg-white/85 backdrop-blur shadow-md border border-white overflow-visible relative isolate z-0 hover:z-50 focus-within:z-50">
                <div className="card-body overflow-visible">
                  <SectionTitle
                    title="Điểm đến"
                    tip="Nhập địa điểm bạn muốn đi (ví dụ: Đà Nẵng, Phú Quốc, Hà Nội...)."
                    icon={
                      <svg
                        className="w-5 h-5 text-primary"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M12 2C8.686 2 6 4.686 6 8c0 4.418 6 14 6 14s6-9.582 6-14c0-3.314-2.686-6-6-6zm0 8.5A2.5 2.5 0 1 1 12 5.5a2.5 2.5 0 0 1 0 5z" />
                      </svg>
                    }
                  />
                  <div className="mt-4">
                    <div
                      className="tooltip tooltip-bottom w-full block"
                      data-tip="Gợi ý: Có thể nhập tên tỉnh/thành hoặc khu vực."
                    >
                      <input
                        type="text"
                        className="input input-bordered w-full text-base placeholder:text-base placeholder:font-medium bg-slate-50 border-slate-200 hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                        placeholder="Bắt đầu nhập địa điểm..."
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Ví dụ: Đà Lạt, Nha Trang, Cần Thơ,....
                  </div>
                </div>
              </div>

              {/* Journey Dates */}
              <div className="card bg-white/85 backdrop-blur shadow-md border border-white overflow-visible relative isolate z-0 hover:z-50 focus-within:z-50">
                <div className="card-body overflow-visible">
                  <SectionTitle
                    title="Thời gian chuyến đi"
                    tip="Chọn ngày bắt đầu và ngày kết thúc. Thời gian hợp lệ: 1–7 ngày."
                    icon={
                      <svg
                        className="w-5 h-5 text-primary"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 22 6.5v14A2.5 2.5 0 0 1 19.5 23h-15A2.5 2.5 0 0 1 2 20.5v-14A2.5 2.5 0 0 1 4.5 4H6V3a1 1 0 0 1 1-1zm12.5 7H4.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5z" />
                      </svg>
                    }
                  />

                  <div className="mt-4 relative">
                    {isCalendarOpen && (
                      <button
                        type="button"
                        aria-label="Close calendar"
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setIsCalendarOpen(false)}
                      />
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="w-full">
                        <div className="text-sm text-slate-600 mb-1 whitespace-nowrap">
                          Ngày bắt đầu
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCalendarPicking("start");
                            setIsCalendarOpen(true);
                          }}
                          className="w-full"
                        >
                          <div className="input input-bordered w-full bg-slate-50 border-slate-200 hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20 flex items-center justify-between">
                            <span
                              className={
                                journeyStart
                                  ? "text-base font-medium text-slate-800"
                                  : "text-base font-medium text-slate-400"
                              }
                            >
                              {journeyStart
                                ? formatDisplayDate(journeyStart)
                                : "Chọn ngày"}
                            </span>
                            <svg
                              className="w-4 h-4 text-slate-400"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 22 6.5v14A2.5 2.5 0 0 1 19.5 23h-15A2.5 2.5 0 0 1 2 20.5v-14A2.5 2.5 0 0 1 4.5 4H6V3a1 1 0 0 1 1-1zm12.5 7H4.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5z" />
                            </svg>
                          </div>
                        </button>
                      </div>

                      <div className="w-full">
                        <div className="text-sm text-slate-600 mb-1">
                          Ngày kết thúc
                        </div>
                        <button
                          type="button"
                          disabled={!journeyStart}
                          onClick={() => {
                            if (!journeyStart) return;
                            setCalendarPicking("end");
                            setIsCalendarOpen(true);
                          }}
                          className="w-full disabled:cursor-not-allowed"
                        >
                          <div
                            className={`input input-bordered w-full flex items-center justify-between ${
                              !journeyStart
                                ? "bg-slate-100 border-slate-200 text-slate-400"
                                : "bg-slate-50 border-slate-200 hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            }`}
                          >
                            <span
                              className={
                                journeyEnd
                                  ? "text-base font-medium text-slate-800"
                                  : "text-base font-medium text-slate-400"
                              }
                            >
                              {journeyEnd
                                ? formatDisplayDate(journeyEnd)
                                : "Chọn ngày"}
                            </span>
                            <svg
                              className="w-4 h-4 text-slate-400"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 22 6.5v14A2.5 2.5 0 0 1 19.5 23h-15A2.5 2.5 0 0 1 2 20.5v-14A2.5 2.5 0 0 1 4.5 4H6V3a1 1 0 0 1 1-1zm12.5 7H4.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5z" />
                            </svg>
                          </div>
                        </button>
                      </div>
                    </div>

                    {isCalendarOpen && (
                      <div className="absolute left-0 right-0 mt-3 z-50">
                        <div className="rounded-2xl border border-slate-200 bg-white shadow-xl p-4">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="flex items-center gap-2 mb-4 px-1">
                              <div className="relative h-12 w-auto min-w-fit bg-slate-50 rounded-full border border-slate-200 flex items-center px-3 flex-shrink-0">
                                <div
                                  className={`h-4 w-1.5 rounded-full mr-2 ${
                                    calendarPicking === "start"
                                      ? "bg-primary"
                                      : "bg-primary/70"
                                  }`}
                                ></div>
                                <span className="text-slate-900 font-bold text-sm whitespace-nowrap">
                                  {calendarPicking === "start"
                                    ? "Ngày bắt đầu"
                                    : "Ngày kết thúc"}
                                </span>
                              </div>
                              <div className="flex-1 h-12 bg-white rounded-full border border-slate-200 flex items-center justify-between px-1 overflow-hidden">
                                <button
                                  type="button"
                                  className="w-5 h-9 flex items-center justify-center hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
                                  onClick={() =>
                                    setCalendarMonth((m) => addMonths(m, -1))
                                  }
                                >
                                  <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M15 18l-6-6 6-6" />
                                  </svg>
                                </button>

                                <div className="text-sm sm:text-base text-slate-700 select-none whitespace-nowrap truncate px-1">
                                  {(() => {
                                    const d = toDateAtMidnight(
                                      `${monthKey(calendarMonth)}-01`
                                    );
                                    return `T${
                                      d.getMonth() + 1
                                    } ${d.getFullYear()}`;
                                  })()}
                                </div>

                                <button
                                  type="button"
                                  className="w-5 h-9 flex items-center justify-center hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0"
                                  onClick={() =>
                                    setCalendarMonth((m) => addMonths(m, 1))
                                  }
                                >
                                  <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <path d="M9 18l6-6-6-6" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500 mb-2">
                            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map(
                              (d, i) => (
                                <div key={`${d}-${i}`} className="py-1">
                                  {d}
                                </div>
                              )
                            )}
                          </div>

                          {(() => {
                            const first = startOfMonth(calendarMonth);
                            const month = first.getMonth();

                            // Monday-first index (0..6)
                            const jsDow = first.getDay(); // 0 Sun
                            const leading = (jsDow + 6) % 7;

                            const days: Array<
                              | { kind: "empty"; key: string }
                              | {
                                  kind: "day";
                                  iso: string;
                                  date: Date;
                                  key: string;
                                }
                            > = [];

                            for (let i = 0; i < leading; i++) {
                              days.push({ kind: "empty", key: `e-${i}` });
                            }

                            for (
                              let d = new Date(first);
                              d.getMonth() === month;
                              d.setDate(d.getDate() + 1)
                            ) {
                              const iso = toLocalISO(d);
                              days.push({
                                kind: "day",
                                iso,
                                date: new Date(d),
                                key: iso,
                              });
                            }

                            const today = todayISO();
                            const startISO = journeyStart;
                            const endISO = journeyEnd;
                            const maxISO = startISO
                              ? addDaysISO(startISO, MAX_TRIP_END_OFFSET)
                              : "";

                            const isInRange = (iso: string) => {
                              if (!startISO || !endISO) return false;
                              const a = toDateAtMidnight(startISO).getTime();
                              const b = toDateAtMidnight(endISO).getTime();
                              const t = toDateAtMidnight(iso).getTime();
                              const lo = Math.min(a, b);
                              const hi = Math.max(a, b);
                              return t >= lo && t <= hi;
                            };

                            const isDisabled = (iso: string) => {
                              if (
                                toDateAtMidnight(iso) < toDateAtMidnight(today)
                              )
                                return true;
                              if (calendarPicking === "end" && startISO) {
                                const clamped = clampISOToRange(
                                  iso,
                                  startISO,
                                  maxISO
                                );
                                return clamped !== iso;
                              }
                              return false;
                            };

                            return (
                              <div className="grid grid-cols-7 gap-1">
                                {days.map((cell) => {
                                  if (cell.kind === "empty") {
                                    return (
                                      <div key={cell.key} className="h-10" />
                                    );
                                  }

                                  const iso = cell.iso;
                                  const selectedStart = isSameISO(
                                    iso,
                                    journeyStart
                                  );
                                  const selectedEnd = isSameISO(
                                    iso,
                                    journeyEnd
                                  );
                                  const inRange = isInRange(iso);
                                  const disabled = isDisabled(iso);

                                  const baseBtn =
                                    "w-10 h-10 mx-auto flex items-center justify-center rounded-full text-sm transition";

                                  let cls = `${baseBtn} `;
                                  if (disabled) {
                                    cls += "text-slate-300 cursor-not-allowed";
                                  } else if (selectedStart || selectedEnd) {
                                    cls +=
                                      "bg-primary text-primary-content shadow";
                                  } else if (inRange) {
                                    cls += "bg-primary/10 text-slate-800";
                                  } else {
                                    cls += "text-slate-700 hover:bg-slate-100";
                                  }

                                  return (
                                    <button
                                      key={cell.key}
                                      type="button"
                                      disabled={disabled}
                                      className={cls}
                                      onClick={() => {
                                        if (disabled) return;

                                        if (calendarPicking === "start") {
                                          handleDateChangeStart(iso);
                                          setCalendarPicking("end");
                                          return;
                                        }

                                        // picking end
                                        handleDateChangeEnd(iso);
                                        setIsCalendarOpen(false);
                                      }}
                                    >
                                      {cell.date.getDate()}
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}

                          <div className="mt-4 flex items-center justify-between">
                            <div className="text-sm text-slate-600">
                              {journeyStart && journeyEnd
                                ? `${formatDisplayDate(
                                    journeyStart
                                  )} – ${formatDisplayDate(journeyEnd)}`
                                : "Chọn tối đa 3 ngày"}
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => setIsCalendarOpen(false)}
                            >
                              Xong
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-slate-600">Số ngày</div>
                    <div className="badge badge-lg badge-primary">
                      {duration > 0 ? `${duration} ngày` : "—"}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    Thời gian tối đa: 3 ngày.
                  </div>
                </div>
              </div>

              <div className="card bg-white/85 backdrop-blur shadow-md border border-white overflow-visible relative isolate z-0 hover:z-50 focus-within:z-50">
                <div className="card-body overflow-visible">
                  <SectionTitle
                    title="Ngân sách"
                    tip="Chọn mức ngân sách phù hợp với chuyến đi."
                    icon={
                      <svg
                        className="w-5 h-5 text-primary shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    }
                  />
                  <div className="mt-3">
                    <div className="flex justify-between items-center">
                      <Tip
                        text="Ưu tiên chi phi tiết kiệm."
                        position="tooltip-bottom"
                      >
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="budget"
                            checked={budget === "low"}
                            onChange={() => setBudget("low")}
                            className="h-5 w-5 accent-primary"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-primary">
                            Tiết kiệm
                          </span>
                        </label>
                      </Tip>
                      <Tip
                        text="Cân bằng chi phí và trải nghiệm."
                        position="tooltip-bottom"
                      >
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="budget"
                            checked={budget === "medium"}
                            onChange={() => setBudget("medium")}
                            className="h-5 w-5 accent-primary"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-primary whitespace-nowrap">
                            Trung bình
                          </span>
                        </label>
                      </Tip>
                      <Tip
                        text="Ưu tiên dịch vụ chất lượng cao."
                        position="tooltip-bottom"
                      >
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="budget"
                            checked={budget === "high"}
                            onChange={() => setBudget("high")}
                            className="h-5 w-5 accent-primary"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-primary">
                            Cao cấp
                          </span>
                        </label>
                      </Tip>
                    </div>
                    {/* <div className="mt-2 text-xs text-slate-500">
                      Đã chọn: {vnBudgetLabel(budget)}
                    </div> */}
                  </div>
                  <div className="my-4 h-px bg-slate-200" />{" "}
                  <SectionTitle
                    title="Mức độ hoạt động"
                    tip="Chọn mức độ hoạt động thể chất trong chuyến đi."
                    icon={
                      <svg
                        className="w-5 h-5 text-primary"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M13.5 5.5c1.09 0 2-.92 2-2a2 2 0 0 0-2-2c-1.11 0-2 .88-2 2 0 1.08.89 2 2 2zM9.89 19.38l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.298 7.298 0 0 0 19 13v-2c-1.91 0-3.5-1-4.31-2.42l-1-1.58c-.4-.6-1-1-1.69-1-.31 0-.5.08-.81.08L6 8.28V13h2V9.58l1.79-.7L8.19 17l-4.9-1-.2 2 7 1.18z" />
                      </svg>
                    }
                  />
                  <div className="mt-4">
                    <div className="flex justify-between items-center">
                      <Tip
                        text="Lịch trình nhẹ, di chuyển ít."
                        position="tooltip-bottom"
                      >
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="activity"
                            checked={activityLevel === "low"}
                            onChange={() => setActivityLevel("low")}
                            className="h-5 w-5 accent-primary"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-primary">
                            Thấp
                          </span>
                        </label>
                      </Tip>
                      <Tip
                        text="Hoạt động vừa phải, cân bằng nghỉ ngơi."
                        position="tooltip-bottom"
                      >
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="activity"
                            checked={activityLevel === "medium"}
                            onChange={() => setActivityLevel("medium")}
                            className="h-5 w-5 accent-primary"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-primary whitespace-nowrap">
                            Trung bình
                          </span>
                        </label>
                      </Tip>
                      <Tip
                        text="Nhiều hoạt động, di chuyển nhiều."
                        position="tooltip-bottom"
                      >
                        <label className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="radio"
                            name="activity"
                            checked={activityLevel === "high"}
                            onChange={() => setActivityLevel("high")}
                            className="h-5 w-5 accent-primary"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-primary">
                            Cao
                          </span>
                        </label>
                      </Tip>
                    </div>
                    {/* <div className="mt-2 text-xs text-slate-500">
                      Đã chọn: {vnActivityLabel(activityLevel)}
                    </div> */}
                  </div>
                </div>
              </div>

              {/* Travel Group */}
              <div className="card bg-white/85 backdrop-blur shadow-md border border-white overflow-visible relative isolate z-0 hover:z-50 focus-within:z-50">
                <div className="card-body overflow-visible">
                  <SectionTitle
                    title="Nhóm du lịch"
                    tip="Số lượng thành viên trong chuyến đii."
                    icon={
                      <svg
                        className="w-5 h-5 text-primary"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM8 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm8 2c-3.314 0-6 1.79-6 4v2h12v-2c0-2.21-2.686-4-6-4zM8 13c-2.761 0-5 1.567-5 3.5V19h6v-2c0-1.318.6-2.5 1.6-3.42A6.98 6.98 0 0 0 8 13z" />
                      </svg>
                    }
                  />

                  <div className="mt-3">
                    <div className="dropdown dropdown-end w-full">
                      <div
                        tabIndex={0}
                        role="button"
                        className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      >
                        <span className="text-slate-700 font-medium">
                          {vnGroupLabel(travelGroup)}
                        </span>
                        <svg
                          className="w-5 h-5 text-slate-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <ul
                        tabIndex={0}
                        className="dropdown-content menu bg-white bg-opacity-100 opacity-100 backdrop-blur-none rounded-lg z-50 w-full p-2 shadow-lg border border-slate-200 mt-1"
                      >
                        <li className="w-full">
                          <button
                            type="button"
                            onClick={() => setTravelGroup("solo")}
                            className={`w-full flex items-center flex-nowrap gap-3 px-3 py-2 rounded-md hover:bg-slate-50 ${
                              travelGroup === "solo" ? "bg-slate-50" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={travelGroup === "solo"}
                              onChange={() => {}}
                              className="h-4 w-4 accent-primary shrink-0"
                              readOnly
                            />
                            <span className="text-slate-700 whitespace-nowrap text-left flex-1">
                              Một mình
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <Tip text="Đi một mình." position="tooltip-left">
                                <div className="w-5 h-5 rounded-full bg-slate-300 text-white text-xs flex items-center justify-center">
                                  ?
                                </div>
                              </Tip>
                            </div>
                          </button>
                        </li>
                        <li className="w-full">
                          <button
                            type="button"
                            onClick={() => setTravelGroup("couple")}
                            className={`w-full flex items-center flex-nowrap gap-3 px-3 py-2 rounded-md hover:bg-slate-50 ${
                              travelGroup === "couple" ? "bg-slate-50" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={travelGroup === "couple"}
                              onChange={() => {}}
                              className="h-4 w-4 accent-primary shrink-0"
                              readOnly
                            />
                            <span className="text-slate-700 whitespace-nowrap text-left flex-1">
                              Cặp đôi
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <Tip
                                text="Đi theo cặp (mặc định 2 người)."
                                position="tooltip-left"
                              >
                                <div className="w-5 h-5 rounded-full bg-slate-300 text-white text-xs flex items-center justify-center">
                                  ?
                                </div>
                              </Tip>
                            </div>
                          </button>
                        </li>
                        <li className="w-full">
                          <button
                            type="button"
                            onClick={() => setTravelGroup("family")}
                            className={`w-full flex items-center flex-nowrap gap-3 px-3 py-2 rounded-md hover:bg-slate-50 ${
                              travelGroup === "family" ? "bg-slate-50" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={travelGroup === "family"}
                              onChange={() => {}}
                              className="h-4 w-4 accent-primary shrink-0"
                              readOnly
                            />
                            <span className="text-slate-700 whitespace-nowrap text-left flex-1">
                              Gia đình
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <Tip
                                text="Đi cùng gia đình (tối đa 6 người)."
                                position="tooltip-left"
                              >
                                <div className="w-5 h-5 rounded-full bg-slate-300 text-white text-xs flex items-center justify-center">
                                  ?
                                </div>
                              </Tip>
                            </div>
                          </button>
                        </li>
                        <li className="w-full">
                          <button
                            type="button"
                            onClick={() => setTravelGroup("friends")}
                            className={`w-full flex items-center flex-nowrap gap-3 px-3 py-2 rounded-md hover:bg-slate-50 ${
                              travelGroup === "friends" ? "bg-slate-50" : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={travelGroup === "friends"}
                              onChange={() => {}}
                              className="h-4 w-4 accent-primary shrink-0"
                              readOnly
                            />
                            <span className="text-slate-700 whitespace-nowrap text-left flex-1">
                              Nhóm bạn
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <Tip
                                text="Đi theo nhóm bạn (tối đa 10 người)."
                                position="tooltip-left"
                              >
                                <div className="w-5 h-5 rounded-full bg-slate-300 text-white text-xs flex items-center justify-center">
                                  ?
                                </div>
                              </Tip>
                            </div>
                          </button>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Group Size Controls */}
                  {(travelGroup === "family" || travelGroup === "friends") && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between px-3 py-2 bg-white border-2 border-slate-200 rounded-lg">
                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center text-primary text-xl font-light hover:bg-primary/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={() =>
                            setGroupSize((prev) => {
                              const min = 2;
                              return Math.max(min, prev - 1);
                            })
                          }
                          disabled={groupSize <= 2}
                        >
                          −
                        </button>

                        <div className="text-base font-semibold text-slate-800 min-w-6 text-center">
                          {groupSize}
                        </div>

                        <button
                          type="button"
                          className="w-8 h-8 flex items-center justify-center text-primary text-xl font-light hover:bg-primary/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          onClick={() =>
                            setGroupSize((prev) => {
                              const max = travelGroup === "family" ? 6 : 10;
                              return Math.min(max, prev + 1);
                            })
                          }
                          disabled={
                            travelGroup === "family"
                              ? groupSize >= 6
                              : groupSize >= 10
                          }
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 text-sm text-slate-500">
                    Bạn đang đi cùng ai?
                  </div>
                </div>
              </div>

              {/* Travel Mode */}
              <div className="card bg-white/85 backdrop-blur shadow-md border border-white overflow-visible relative isolate z-0 hover:z-50 focus-within:z-50">
                <div className="card-body overflow-visible">
                  <SectionTitle
                    title="Phương tiện du lịch"
                    tip="Chọn cách di chuyển chính giữa các hoạt động."
                    icon={
                      <svg
                        className="w-5 h-5 text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="6" cy="18" r="3" />
                        <circle cx="18" cy="18" r="3" />
                        <path d="M6 18l4-8h4l4 8" />
                        <path d="M10 10l-2-3H6" />
                        <path d="M14 10h5l-2 4" />
                        <path d="M12 18h2" />
                      </svg>
                    }
                  />

                  <div className="mt-4">
                    <div className="dropdown dropdown-end w-full">
                      <div
                        tabIndex={0}
                        role="button"
                        className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      >
                        <span className="text-slate-700 font-medium">
                          {travelMode}
                        </span>
                        <svg
                          className="w-5 h-5 text-slate-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <ul
                        tabIndex={0}
                        className="dropdown-content menu bg-white bg-opacity-100 opacity-100 backdrop-blur-none rounded-lg z-50 w-full p-2 shadow-lg border border-slate-200 mt-1"
                      >
                        {travelModeOptions.map((m) => (
                          <li key={m.value} className="w-full">
                            <button
                              type="button"
                              onClick={() => setExclusiveTravelMode(m.value)}
                              className={`w-full flex items-center flex-nowrap gap-3 px-3 py-2 rounded-md hover:bg-slate-50 ${
                                travelMode === m.value ? "bg-slate-50" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={travelMode === m.value}
                                onChange={() => {}}
                                className="h-4 w-4 accent-primary shrink-0"
                                readOnly
                              />
                              <span className="text-slate-700 whitespace-nowrap text-left flex-1">
                                {m.value}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <Tip text={m.tip} position="tooltip-left">
                                  <div className="w-5 h-5 rounded-full bg-slate-300 text-white text-xs flex items-center justify-center">
                                    ?
                                  </div>
                                </Tip>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-slate-500">
                    Phương tiện di chuyển giữa các hoạt động
                  </div>
                </div>
              </div>

              {/* Categories */}
              <div className="card bg-white/85 backdrop-blur shadow-md border border-white overflow-visible relative isolate z-0 hover:z-50 focus-within:z-50">
                <div className="card-body overflow-visible">
                  <SectionTitle
                    title="Danh mục"
                    tip="Chọn các loại trải nghiệm bạn muốn có trong chuyến đi."
                    icon={
                      <svg
                        className="w-5 h-5 text-primary"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M10 3H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm10 0h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zM10 13H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zm10 0h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z" />
                      </svg>
                    }
                  />

                  <div className="mt-4">
                    <div className="dropdown dropdown-end w-full">
                      <div
                        tabIndex={0}
                        role="button"
                        className="flex items-center justify-between w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                      >
                        <span
                          className={`text-base font-medium ${
                            categories.length > 0
                              ? "text-slate-700"
                              : "text-slate-400"
                          }`}
                        >
                          {categories.length > 0
                            ? `${categories.length} danh mục đã chọn`
                            : "Chọn danh mục"}
                        </span>
                        <svg
                          className="w-5 h-5 text-slate-400"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <ul
                        tabIndex={0}
                        className="dropdown-content menu bg-white bg-opacity-100 opacity-100 backdrop-blur-none rounded-lg z-50 w-full p-2 shadow-lg border border-slate-200 mt-1 max-h-80 overflow-y-auto"
                      >
                        {categoryOptions.map((c) => (
                          <li key={c.value} className="w-full">
                            <button
                              type="button"
                              onClick={() => toggleCategory(c.value)}
                              className={`w-full flex items-center flex-nowrap gap-3 px-3 py-2 rounded-md hover:bg-slate-50 ${
                                categories.includes(c.value)
                                  ? "bg-slate-50"
                                  : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={categories.includes(c.value)}
                                onChange={() => {}}
                                className="h-4 w-4 accent-primary shrink-0"
                                readOnly
                              />
                              <span className="text-slate-700 whitespace-nowrap text-left flex-1">
                                {c.value}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <Tip text={c.tip} position="tooltip-left before:w-36 before:whitespace-normal before:text-left">
                                  <div className="w-5 h-5 rounded-full bg-slate-300 text-white text-xs flex items-center justify-center">
                                    ?
                                  </div>
                                </Tip>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-slate-500">
                    {categories.length > 0
                      ? `Đã chọn: ${categories.join(", ")}`
                      : "Danh mục hoạt động ưa thích"}
                  </div>
                </div>
              </div>

              {/* Other options (full width) */}
              <div className="card bg-white/85 backdrop-blur shadow-md border border-white md:col-span-2 lg:col-span-3 overflow-visible relative isolate z-0 hover:z-50 focus-within:z-50">
                <div className="card-body overflow-visible">
                  <SectionTitle
                    title="Tùy chọn khác"
                    tip="Ghi thêm yêu cầu: phong cách lịch trình, món ăn muốn thử, lưu ý sức khỏe, hạn chế di chuyển, v.v."
                    icon={
                      <svg
                        className="w-5 h-5 text-primary"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm1 5a1 1 0 0 0-2 0v1.126A3.001 3.001 0 0 0 12 14a1 1 0 0 1 0 2H9a1 1 0 0 0 0 2h2v1a1 1 0 0 0 2 0v-1.126A3.001 3.001 0 0 0 12 10a1 1 0 0 1 0-2h3a1 1 0 0 0 0-2h-2z" />
                      </svg>
                    }
                  />

                  <div className="mt-4 w-full">
                    <div className="w-full">
                      <div
                        className="tooltip tooltip-bottom w-full block relative z-[9999]"
                        data-tip="Ví dụ: Ưu tiên quán ăn địa phương, lịch trình nhẹ, tránh leo núi,..."
                      >
                        <textarea
                          className="textarea textarea-bordered w-full min-h-18 text-base placeholder:text-base placeholder:font-medium bg-slate-50 border-slate-200 hover:border-slate-300 focus:border-primary focus:ring-2 focus:ring-primary/20"
                          placeholder="Nhập yêu cầu khác theo mong muốn của bạn..."
                          value={otherOptions}
                          onChange={(e) => setOtherOptions(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="alert alert-error mt-6">
                <span>{error}</span>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <Tip text="← Quay lại trang chủ." position="tooltip-top">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => router.push("/")}
                >
                  Trang chủ
                </button>
              </Tip>

              <Tip
                text="Tạo kế hoạch chuyến đi từ các thông tin đã chọn."
                position="tooltip-top"
              >
                <button
                  type="submit"
                  className="btn btn-lg btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="loading loading-spinner" />
                      Đang tạo kế hoạch...
                    </>
                  ) : (
                    "Tạo kế hoạch chuyến đi"
                  )}
                </button>
              </Tip>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
