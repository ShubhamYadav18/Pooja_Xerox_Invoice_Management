import nodemailer from "nodemailer";

export interface ProfileSmtpConfig {
  user: string;
  pass: string;
  host: string;
  port: number;
  secure: boolean;
  from: string;
  configured: boolean;
  profileCode: string;
  profileName: string;
  missingEnvVar?: string;
}

export interface ProfileLike {
  code?: string | null;
  name?: string | null;
  settings?: {
    businessName?: string | null;
    email?: string | null;
  } | null;
}

/**
 * Returns profile-specific SMTP configuration.
 *
 * For POOJA_XEROX:
 *   Uses POOJA_XEROX_SMTP_USER / POOJA_XEROX_SMTP_PASS, falling back to SMTP_USER / SMTP_PASS.
 *
 * For POOJA_ENTERPRISES:
 *   Uses POOJA_ENTERPRISES_SMTP_USER / POOJA_ENTERPRISES_SMTP_PASS.
 */
export function getProfileSmtpConfig(profile?: ProfileLike | null): ProfileSmtpConfig {
  const rawCode = (profile?.code || "").toUpperCase();
  const rawName = (profile?.name || profile?.settings?.businessName || "").toUpperCase();
  const isEnterprises = rawCode.includes("ENTERPRISE") || rawName.includes("ENTERPRISE");

  const profileCode = isEnterprises ? "POOJA_ENTERPRISES" : "POOJA_XEROX";
  const profileName =
    profile?.settings?.businessName ||
    profile?.name ||
    (isEnterprises ? "Pooja Enterprises" : "Pooja Xerox");

  const defaultHost = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const defaultPort = Number(process.env.SMTP_PORT || "465");
  const defaultSecure = process.env.SMTP_SECURE
    ? process.env.SMTP_SECURE === "true"
    : defaultPort === 465;

  if (profileCode === "POOJA_ENTERPRISES") {
    const rawUser = process.env.POOJA_ENTERPRISES_SMTP_USER?.trim() || "";
    const rawPass = process.env.POOJA_ENTERPRISES_SMTP_PASS?.trim() || "";
    // Clean up Gmail app password (remove spaces if user pasted 4x4 blocks)
    const user = rawUser;
    const pass = rawPass.replace(/\s+/g, "");

    const host = process.env.POOJA_ENTERPRISES_SMTP_HOST?.trim() || defaultHost;
    const port = Number(process.env.POOJA_ENTERPRISES_SMTP_PORT || defaultPort);
    const secure = process.env.POOJA_ENTERPRISES_SMTP_SECURE
      ? process.env.POOJA_ENTERPRISES_SMTP_SECURE === "true"
      : defaultSecure;

    const from =
      process.env.POOJA_ENTERPRISES_SMTP_FROM?.trim() ||
      (user ? `"${profileName}" <${user}>` : `"${profileName}"`);

    const configured = Boolean(user && pass);

    return {
      user,
      pass,
      host,
      port,
      secure,
      from,
      configured,
      profileCode: "POOJA_ENTERPRISES",
      profileName,
      missingEnvVar: !configured
        ? "POOJA_ENTERPRISES_SMTP_USER and POOJA_ENTERPRISES_SMTP_PASS"
        : undefined,
    };
  }

  // Default / POOJA_XEROX
  const rawUser =
    process.env.POOJA_XEROX_SMTP_USER?.trim() ||
    process.env.SMTP_USER?.trim() ||
    process.env.GMAIL_USER?.trim() ||
    process.env.EMAIL_USER?.trim() ||
    "";
  const rawPass =
    process.env.POOJA_XEROX_SMTP_PASS?.trim() ||
    process.env.SMTP_PASS?.trim() ||
    process.env.GMAIL_APP_PASSWORD?.trim() ||
    process.env.EMAIL_PASS?.trim() ||
    "";
  // Clean up Gmail app password (remove spaces if user pasted 4x4 blocks)
  const user = rawUser;
  const pass = rawPass.replace(/\s+/g, "");

  const host = process.env.POOJA_XEROX_SMTP_HOST?.trim() || defaultHost;
  const port = Number(process.env.POOJA_XEROX_SMTP_PORT || defaultPort);
  const secure = process.env.POOJA_XEROX_SMTP_SECURE
    ? process.env.POOJA_XEROX_SMTP_SECURE === "true"
    : defaultSecure;

  const from =
    process.env.POOJA_XEROX_SMTP_FROM?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    (user ? `"${profileName}" <${user}>` : `"${profileName}"`);

  const configured = Boolean(user && pass);

  return {
    user,
    pass,
    host,
    port,
    secure,
    from,
    configured,
    profileCode: "POOJA_XEROX",
    profileName,
    missingEnvVar: !configured
      ? "POOJA_XEROX_SMTP_USER and POOJA_XEROX_SMTP_PASS (or SMTP_USER / SMTP_PASS)"
      : undefined,
  };
}

export function createTransporterForProfile(config: ProfileSmtpConfig) {
  if (!config.configured) {
    throw new Error(
      `SMTP credentials not configured for ${config.profileName}. Please set ${config.missingEnvVar} in .env.`
    );
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}
