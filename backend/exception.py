# -*- coding: utf-8 -*-
"""
爬虫与下载相关异常类型，便于接口层区分限流、空数据、通用失败并做不同提示或重试策略。
"""


class CrawlerError(Exception):
    """爬虫相关异常基类"""

    def __init__(self, message: str, *args, **kwargs):
        self.message = message
        super().__init__(message, *args, **kwargs)


class RateLimitError(CrawlerError):
    """访问受限（请求过于频繁、错误码 300013 等），建议稍后重试，不宜立即重试同一链接。"""


class DataEmptyError(CrawlerError):
    """笔记内容为空（未解析到标题、正文或图片），可能页面结构变化或需登录。"""


class DataFetchError(CrawlerError):
    """抓取或解析失败（网络、超时、数据结构异常等）。"""
