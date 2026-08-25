import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.yiduoyixing.hub",
  appName: "一朵一星",
  webDir: "dist",
  server: {
    androidScheme: "https"
  },
  android: {
    allowMixedContent: false
  }
};

export default config;
