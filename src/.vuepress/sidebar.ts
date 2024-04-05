import { sidebar } from "vuepress-theme-hope";

export default sidebar({
  "/": [
    "",
    {
      text: "实验文档",
      icon: "laptop-code",
      prefix: "labs/",
      link: "labs/",
      // children: "structure",
      children: [
        "01-util/",
        "02-syscall/",
        "03-pgtbl/",
        "04-trap/",
        "05-lazy/",
        "06-cow/",
        "07-thread/",
        "08-lock/",
        "09-fs/",
        "10-mmap/",
        "11-net/",

      ] 
    },
    {
      text: "学习笔记",
      icon: "laptop-code",
      prefix: "blogs/",
      link: "blogs/",
      // children: "structure",
      children: [
        "xx-others/",
        "01-process/",
        "02-memory/",
        "03-filesystem/",
        "04-device/",
      ]
    },
    // {
    //   text: "案例",
    //   icon: "laptop-code",
    //   prefix: "demo/",
    //   link: "demo/",
    //   children: "structure",
    // },
    // {
    //   text: "文档",
    //   icon: "book",
    //   prefix: "guide/",
    //   children: "structure",
    // },
    // {
    //   text: "幻灯片",
    //   icon: "person-chalkboard",
    //   link: "https://plugin-md-enhance.vuejs.press/zh/guide/content/revealjs/demo.html",
    // },
  ],
});
