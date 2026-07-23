# Entry point: this is the file uvicorn runs to start the server. It creates
# the FastAPI app, allows the browser app to call it (CORS), and plugs in
# every router we built.
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers import business, customers, items, packages, invoices, payments

app = FastAPI(title="Snapbill API")

# CORS = "Cross-Origin Resource Sharing". Browsers block a web page from
# calling an API on a different domain unless that API explicitly allows it.
# Since the app is hosted on github.io and this API is hosted elsewhere,
# we have to list which origins are allowed to call us.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://mustafasyed13.github.io",
        "http://localhost:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "ok", "service": "Snapbill API"}


app.include_router(business.router)
app.include_router(customers.router)
app.include_router(items.router)
app.include_router(packages.router)
app.include_router(invoices.router)
app.include_router(payments.router)
