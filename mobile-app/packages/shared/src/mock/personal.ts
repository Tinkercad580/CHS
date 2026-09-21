import type { PersonalInfo } from "../types/common";

/** The signed-in resident's editable contact fields — the mobile number is set by the office and lives outside this. */
export const personalInfo: PersonalInfo = {
  email: "anita.deshpande@gmail.com",
  alt: "+91 98812 07744",
  emergency: "Rajesh Deshpande · +91 98220 41156",
};

export const residentName = "Anita Deshpande";
export const residentMobile = "+91 98220 41155";
export const residentMemberSince = "Resident since March 2019 · member no. SV-1204";
export const deliveryGuardContact = { label: "Main gate", value: "Ramesh Yadav · on duty" };
