import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

export default defineUserConfig({
  base: "/",

  lang: "zh-CN",
  title: "xv6分析与实验",
  description: "学习MIT6.s081 20202 xv6, 制作个人实验文档",

  theme,

  // 和 PWA 一起启用
  // shouldPrefetch: false,
});
