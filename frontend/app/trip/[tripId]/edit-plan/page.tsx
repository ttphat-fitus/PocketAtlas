"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../contexts/AuthContext";

import TripPlanPage from "../../plan/page";

export default function EditTripPlanPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params?.tripId as string;
  const { user, loading: authLoading, getIdToken } = useAuth();

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth");
      return;
    }

    const load = async () => {
      try {
        setError("");
        setReady(false);

        const token = await getIdToken();
        if (!token) throw new Error("Not authenticated");

        const res = await fetch(`/api/trip/${tripId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to fetch trip");
        }

        const tripPlan = data?.trip_plan || null;
        if (!tripPlan) throw new Error("Trip plan not found");

        const normalizedPlan = {
          ...tripPlan,
          trip_id: tripId,
        };

        const tripParams = {
          destination: data?.destination,
          duration: data?.duration,
          budget: data?.budget,
          travel_mode: data?.travel_mode,
          activity_level: data?.activity_level,
          start_date: data?.start_date,
          preferences: data?.preferences,
        };

        const storedLanguage = localStorage.getItem("language");
        const backLabel = storedLanguage === "en" ? "Back" : "← Quay lại";

        localStorage.setItem("tripPlan", JSON.stringify(normalizedPlan));
        localStorage.setItem("tripParams", JSON.stringify(tripParams));
        localStorage.setItem("planBackHref", `/trip/${tripId}`);
        localStorage.setItem("planBackLabel", backLabel);

        setReady(true);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    };

    if (tripId) load();
  }, [authLoading, user, tripId, getIdToken, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="alert alert-error max-w-lg">
          <span>{error}</span>
          <button className="btn btn-sm" onClick={() => router.push(`/trip/${tripId}`)}>
            ← Quay lại
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return <TripPlanPage />;
}
