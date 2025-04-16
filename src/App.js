import React, { useState, useEffect } from "react";
import { Contract, BrowserProvider, parseEther } from "ethers";
import "./App.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const App = () => {
    const [walletAddress, setWalletAddress] = useState("");
    const [activeTab, setActiveTab] = useState("");
    const [tasks, setTasks] = useState([]);
    const [newTask, setNewTask] = useState("");
    const [bounty, setBounty] = useState("");
    const [selectedParticipants, setSelectedParticipants] = useState({});

    const contractAddress = "0x00000000000000000000000000000000005976fc";
    const abi = [
        "function createTask(string memory description) public payable",
        "function getAllTasks() public view returns (uint256, tuple(uint256 id, string description, uint256 reward, address creator, address[] participants, bool completed)[] memory)",
        "function addParticipant(uint256 taskId) public",
        "function completeTask(uint256 taskId, address participant) public",
    ];

    const connectWallet = async () => {
        try {
            if (!window.ethereum) {
                alert("MetaMask is not installed!");
                return;
            }

            await window.ethereum.request({ method: "eth_requestAccounts" });
            const provider = new BrowserProvider(window.ethereum);
            const accounts = await provider.listAccounts();
            const connectedAddress = accounts[0]?.address || "Unknown";
            setWalletAddress(connectedAddress);
            toast.success("Wallet connected!");
        } catch (error) {
            console.error("Error connecting to MetaMask:", error);
            toast.error("Error connecting wallet.");
        }
    };

    const disconnectWallet = () => {
        console.log("Wallet disconnected.");
        setWalletAddress("");
        setActiveTab("");
        toast.info("Wallet disconnected.");
    };

    const fetchTasks = async () => {
        try {
            const provider = new BrowserProvider(window.ethereum);
            const contract = new Contract(contractAddress, abi, provider);
            const [numTasks, tasksList] = await contract.getAllTasks();

            console.log("Fetched", numTasks, tasksList);

            const parsedTasks = tasksList.map((task) => ({
                id: typeof task.id === "object" && typeof task.id.toNumber === "function"
                    ? task.id.toNumber()
                    : Number(task.id),
                description: task.description,
                reward: Number(task.reward) / Math.pow(10, 8),
                creator: task.creator,
                participants: task.participants || [],
                completed: task.completed,
            }));

            setTasks(parsedTasks);
            toast.success(`Fetched tasks!`);
        } catch (error) {
            console.error("Error fetching tasks:", error);
            toast.error(`Error fetching tasks`);
        }
    };

    const handleCreateTask = async () => {
        try {
            if (!newTask || !bounty || isNaN(bounty)) {
                toast.warning("Please fill out all fields correctly.");
                return;
            }

            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new Contract(contractAddress, abi, signer);

            const tx = await contract.createTask(newTask, {
                value: parseEther(bounty),
            });

            console.log("Transaction sent:", tx);
            await tx.wait();
            console.log("Transaction confirmed:", tx.hash);

            toast.success("Task created!");
            setNewTask("");
            setBounty("");
            await fetchTasks();
        } catch (error) {
            console.error("Error creating task:", error);
            toast.error(`Error in creating tasks`);
        }
    };

    const handleRegister = async (taskId) => {
        try {
            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new Contract(contractAddress, abi, signer);

            const tx = await contract.addParticipant(taskId);
            await tx.wait();

            toast.success(`Registered for task #${taskId}`);
            await fetchTasks();
        } catch (error) {
            console.error("Error registering:", error);
            toast.error(`Failed to register for task #${taskId}`);
        }
    };

    const handleCompleteTask = async (taskId, participant) => {
        try {
            const provider = new BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new Contract(contractAddress, abi, signer);

            const tx = await contract.completeTask(taskId, participant);
            await tx.wait();

            toast.success(`Task #${taskId} marked complete!`);
            await fetchTasks();
        } catch (error) {
            console.error("Error completing task:", error);
            toast.error(`Error in completing the task`);
        }
    };

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on("accountsChanged", connectWallet);
            window.ethereum.on("chainChanged", () => window.location.reload());
        }
    }, []);

    return (
        <div className="appContainer">
            <ToastContainer position="top-center" autoClose={3000} />
            <div className="headerContainer">
                <h1 className="heading">Tasks and Bounties</h1>
                {!walletAddress ? (
                    <button className="button" onClick={connectWallet}>
                        Connect Wallet
                    </button>
                ) : (
                    <>
                        <button className="disconnectButton" onClick={disconnectWallet}>
                            Disconnect Wallet
                        </button>
                        <p>Wallet Address: {walletAddress}</p>
                        <div className="tabs">
                            {["Open Bounties", "Create Task", "Complete Task"].map((tab) => (
                                <button
                                    key={tab}
                                    className={`tabButton ${activeTab === tab ? "active" : ""}`}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </>
                )}
                <br />
                <hr />
            </div>

            {walletAddress && (
                <div className="sectionContainer">
                    {activeTab === "Open Bounties" && (
                        <div className="sectionContent">
                            <button className="button" onClick={fetchTasks}>
                                Fetch Open Bounties
                            </button>
                            <div className="taskGrid">
                                {(() => {
                                    const openTasks = tasks.filter(
                                        (task) =>
                                            task.creator.toLowerCase() !== walletAddress.toLowerCase() &&
                                            !task.completed
                                    );

                                    if (openTasks.length === 0) {
                                        return <p>No open bounties, come back later :)</p>;
                                    }

                                    return openTasks.map((task, index) => {
                                        const isAlreadyParticipant = task.participants.some(
                                            (p) => p.toLowerCase() === walletAddress.toLowerCase()
                                        );

                                        return (
                                            <div key={index} className="taskCard">
                                                <p><strong>ID:</strong> {task.id}</p>
                                                <p><strong>Description:</strong> {task.description}</p>
                                                <p><strong>Reward:</strong> {task.reward} HBAR</p>
                                                <p><strong>Creator:</strong> {task.creator}</p>
                                                <div>
                                                    <strong>Participants:</strong>
                                                    {task.participants.length > 0 ? (
                                                        task.participants.map((p, i) => (
                                                            <div key={i} style={{ marginLeft: "15px", marginTop: "4px", lineHeight: "1.4" }}>
                                                                {p}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div style={{ marginLeft: "15px", marginTop: "4px" }}>None</div>
                                                    )}
                                                </div>


                                                <p><strong>Completed:</strong> {task.completed ? "Yes" : "No"}</p>
                                                {!isAlreadyParticipant ? (
                                                    <button className="button" onClick={() => handleRegister(task.id)}>
                                                        Register
                                                    </button>
                                                ) : (
                                                    <p style={{ color: "green", fontWeight: "bold" }}>Already Registered</p>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    )}

                    {activeTab === "Create Task" && (
                        <div className="sectionContent">
                            <input
                                type="text"
                                value={newTask}
                                onChange={(e) => setNewTask(e.target.value)}
                                placeholder="Enter task description"
                                className="input"
                            />
                            <input
                                type="number"
                                value={bounty}
                                onChange={(e) => setBounty(e.target.value)}
                                placeholder="Enter bounty (HBAR)"
                                className="input"
                            />
                            <button className="button" onClick={handleCreateTask}>
                                Create Task
                            </button>
                        </div>
                    )}

                    {activeTab === "Complete Task" && (
                        <div className="sectionContent">
                            <button className="button" onClick={fetchTasks}>
                                Fetch My Tasks
                            </button>

                            {/* In Progress Tasks */}
                            <h3>In Progress</h3>
                            <div className="taskGrid">
                                {tasks
                                    .filter(
                                        (task) =>
                                            task.creator.toLowerCase() === walletAddress.toLowerCase() &&
                                            !task.completed
                                    )
                                    .map((task, index) => (
                                        <div key={index} className="taskCard">
                                            <p><strong>ID:</strong> {task.id}</p>
                                            <p><strong>Description:</strong> {task.description}</p>
                                            <p><strong>Reward:</strong> {task.reward} HBAR</p>
                                            <div>
                                                <strong>Participants:</strong>
                                                {task.participants.length > 0 ? (
                                                    task.participants.map((p, i) => (
                                                        <div key={i} style={{ marginLeft: "15px", marginTop: "4px", lineHeight: "1.4" }}>
                                                            {p}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ marginLeft: "15px", marginTop: "4px" }}>None</div>
                                                )}
                                            </div>


                                            <p><strong>Completed:</strong> No</p>

                                            {task.participants.length > 0 && (
                                                <div className="center-text">
                                                    <select
                                                        className="input"
                                                        value={selectedParticipants[task.id] || ""}
                                                        onChange={(e) =>
                                                            setSelectedParticipants((prev) => ({
                                                                ...prev,
                                                                [task.id]: e.target.value,
                                                            }))
                                                        }
                                                    >
                                                        <option value="">Select a participant</option>
                                                        {task.participants.map((p, i) => (
                                                            <option key={i} value={p}>
                                                                {p}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        className="button"
                                                        disabled={!selectedParticipants[task.id]}
                                                        onClick={() =>
                                                            handleCompleteTask(task.id, selectedParticipants[task.id])
                                                        }
                                                    >
                                                        Mark Complete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                            </div>

                            {/* Completed Tasks */}
                            <h3>Completed</h3>
                            <div className="taskGrid">
                                {tasks
                                    .filter(
                                        (task) =>
                                            task.creator.toLowerCase() === walletAddress.toLowerCase() &&
                                            task.completed
                                    )
                                    .map((task, index) => (
                                        <div key={index} className="taskCard completed">
                                            <p><strong>ID:</strong> {task.id}</p>
                                            <p><strong>Description:</strong> {task.description}</p>
                                            <p><strong>Reward:</strong> {task.reward} HBAR</p>
                                            <div>
                                                <strong>Participants:</strong>
                                                {task.participants.length > 0 ? (
                                                    task.participants.map((p, i) => (
                                                        <div key={i} style={{ marginLeft: "15px", marginTop: "4px", lineHeight: "1.4" }}>
                                                            {p}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div style={{ marginLeft: "15px", marginTop: "4px" }}>None</div>
                                                )}
                                            </div>

                                            <p><strong>Completed:</strong> Yes</p>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default App;