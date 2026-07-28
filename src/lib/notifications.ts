import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { NotificationType } from "../types";

export async function createNotification({
  userId,
  title,
  message,
  type,
  amount,
}: {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  amount?: number;
}) {
  if (!userId) return;
  try {
    const notifRef = collection(db, "notifications");
    await addDoc(notifRef, {
      userId,
      title,
      message,
      type,
      amount: amount || 0,
      read: false,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("Error creating in-app notification:", err);
  }
}
