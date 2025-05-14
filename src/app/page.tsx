export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4 text-center">
        Meeting Script Generator
      </h1>
      <p className="text-xl text-gray-600 mb-8 text-center">
        Generate professional meeting scripts with AI-powered assistance
      </p>
      <div className="flex space-x-4">
        <button className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition">
          Get Started
        </button>
        <button className="bg-secondary text-white px-6 py-3 rounded-lg hover:bg-green-700 transition">
          Learn More
        </button>
      </div>
    </main>
  )
}
