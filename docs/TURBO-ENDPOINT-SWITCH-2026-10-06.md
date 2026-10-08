# Turbo 推理接入点切换

用户指定模型：截图中的Doubao-Seed-2.1-turbo 260628，接入点ep-20261006124235-8prwq。

已修改本地.env的VOLC_ENGINE_VISION_MODEL并重启API和worker，不修改历史模型记录或历史费用。未输出或改动API Key。项目显式thinking disabled参数保持原有设置。

真实验证：发送不含监控画面的最小文本请求，服务商返回HTTP403，error.code为AccountOverdueError，提示当前凭据所属账号存在欠费余额。新接入点尚未通过可用性验证；需要充值该账号或配置可用账号凭据后重测。未把配置成功当作调用成功。

仅本地运行配置变更，未修改产品代码，本次未重复代码测试和UI审核。Turbo费用尚未配置精确价格，不能直接沿用历史Pro费率；待恢复调用并确认返回模型及计费档位后校准。
