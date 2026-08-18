from fastapi import HTTPException, status


class NotFoundError(HTTPException):
    def __init__(self, resource: str, resource_id: str = ""):
        detail = f"{resource} not found"
        if resource_id:
            detail = f"{resource} '{resource_id}' not found"
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class ConflictError(HTTPException):
    def __init__(self, message: str):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=message)


class PeriodLockedError(HTTPException):
    def __init__(self, message: str = "This period is locked."):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=message)


class ValidationError(HTTPException):
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=message
        )


class AIGenerationError(HTTPException):
    def __init__(self, message: str = "AI generation failed"):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=message
        )


class DeliveryError(HTTPException):
    def __init__(self, message: str = "Delivery failed"):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=message
        )


class PlanLockedError(HTTPException):
    def __init__(self, resource: str = "Plan"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{resource} is locked and cannot be modified.",
        )
