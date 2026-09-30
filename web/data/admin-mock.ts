import type {
  ActivityLog,
  AnalyticsData,
  Customer,
  Gate,
} from "@/types/admin";

export const adminGates: Gate[] = [
  {
    id: "1",
    name: "Gate 01",
    location: "Toyota Service Entrance",
    status: "CONNECTED",
    waitingCount: 5,
    currentTicket: "A-104",
    currentCustomerId: "customer-1",

    services: {
      lpr: true,
      sap: true,
      queueEngine: true,
      voiceAssistant: true,
      notifications: true,
      redis: true,
    },
  },

  {
    id: "2",
    name: "Gate 02",
    location: "Main Service Entrance",
    status: "CONNECTED",
    waitingCount: 3,
    currentTicket: "B-203",
    currentCustomerId: "customer-4",

    services: {
      lpr: true,
      sap: true,
      queueEngine: true,
      voiceAssistant: true,
      notifications: true,
      redis: true,
    },
  },

  {
    id: "3",
    name: "Gate 03",
    location: "Express Service Gate",
    status: "CONNECTED",
    waitingCount: 3,
    currentTicket: "C-087",
    currentCustomerId: "customer-6",

    services: {
      lpr: true,
      sap: true,
      queueEngine: true,
      voiceAssistant: true,
      notifications: true,
      redis: true,
    },
  },

  {
    id: "4",
    name: "Gate 04",
    location: "North Service Gate",
    status: "OFFLINE",
    waitingCount: 0,

    services: {
      lpr: false,
      sap: false,
      queueEngine: false,
      voiceAssistant: false,
      notifications: false,
      redis: false,
    },
  },

  {
    id: "5",
    name: "Gate 05",
    location: "Customer Pickup Gate",
    status: "CONNECTED",
    waitingCount: 0,

    services: {
      lpr: true,
      sap: true,
      queueEngine: true,
      voiceAssistant: true,
      notifications: true,
      redis: true,
    },
  },
];

export const adminCustomers: Customer[] = [
  {
    id: "customer-1",
    name: "Ahmed Hassan",
    type: "TOYOTA_CUSTOMER",
    phone: "01012345678",
    vehicle: "Toyota Corolla",
    plate: "ABC-1234",
    ticket: "A-104",
    gateId: "1",
    status: "IN_SERVICE",
    checkInTime: "16:18",
    waitTime: "04:32",
  },

  {
    id: "customer-2",
    name: "Sara Ahmed",
    type: "NEW_CUSTOMER",
    phone: "01123456789",
    vehicle: "Toyota Corolla",
    plate: "DEF-7812",
    ticket: "A-105",
    gateId: "1",
    status: "WAITING",
    checkInTime: "16:20",
    waitTime: "02:14",
  },

  {
    id: "customer-3",
    name: "Omar Hassan",
    type: "TOYOTA_CUSTOMER",
    phone: "01098765432",
    vehicle: "Toyota Yaris",
    plate: "GHI-2390",
    ticket: "A-106",
    gateId: "1",
    status: "WAITING",
    checkInTime: "16:21",
    waitTime: "05:32",
  },

  {
    id: "customer-4",
    name: "Mohamed Ali",
    type: "TOYOTA_CUSTOMER",
    phone: "01055556666",
    vehicle: "Toyota Camry",
    plate: "XYZ-4521",
    ticket: "B-203",
    gateId: "2",
    status: "IN_SERVICE",
    checkInTime: "16:12",
    waitTime: "03:10",
  },

  {
    id: "customer-5",
    name: "Nour Khaled",
    type: "NEW_CUSTOMER",
    phone: "01277778888",
    vehicle: "Toyota RAV4",
    plate: "JKL-5532",
    ticket: "A-108",
    gateId: "1",
    status: "WAITING",
    checkInTime: "16:10",
    waitTime: "11:03",
  },

  {
    id: "customer-6",
    name: "Omar Khaled",
    type: "TOYOTA_CUSTOMER",
    phone: "01033334444",
    vehicle: "Toyota Yaris",
    plate: "GHI-2390",
    ticket: "C-087",
    gateId: "3",
    status: "IN_SERVICE",
    checkInTime: "16:15",
    waitTime: "02:50",
  },

  {
    id: "customer-7",
    name: "Karim Adel",
    type: "TOYOTA_CUSTOMER",
    phone: "01044445555",
    vehicle: "Toyota Corolla",
    plate: "MNO-8821",
    ticket: "C-088",
    gateId: "3",
    status: "COMPLETED",
    checkInTime: "15:48",
  },
];

export const adminActivityLogs: ActivityLog[] = [
  {
    id: "log-1",
    timestamp: "16:21:03",
    gateId: "1",
    event: "Plate Detected",
    description: "Plate ABC-1234 detected by LPR",
    status: "SUCCESS",
  },

  {
    id: "log-2",
    timestamp: "16:21:05",
    gateId: "1",
    event: "SAP Lookup",
    description: "Customer found in SAP",
    status: "SUCCESS",
  },

  {
    id: "log-3",
    timestamp: "16:21:07",
    gateId: "1",
    event: "Ticket Created",
    description: "Ticket A-105 created",
    status: "SUCCESS",
  },

  {
    id: "log-4",
    timestamp: "16:21:12",
    gateId: "1",
    event: "Notification Sent",
    description: "Customer notification sent successfully",
    status: "SUCCESS",
  },

  {
    id: "log-5",
    timestamp: "16:20:41",
    gateId: "3",
    event: "Customer Lookup",
    description: "Customer information retrieved",
    status: "SUCCESS",
  },

  {
    id: "log-6",
    timestamp: "16:19:32",
    gateId: "4",
    event: "Connection Lost",
    description: "Gate 04 connection was lost",
    status: "ERROR",
  },

  {
    id: "log-7",
    timestamp: "16:18:21",
    gateId: "2",
    event: "Queue Updated",
    description: "Customer added to queue",
    status: "INFO",
  },
];

export const adminAnalytics: AnalyticsData = {
  totalCheckIns: 128,
  completedCheckIns: 94,
  averageWaitTime: "04:32",
  averageServiceTime: "02:18",
  gateUtilization: 76,
};